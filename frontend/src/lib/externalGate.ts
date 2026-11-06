// Ön yüz sunucusundan dış kaynaklara (Yahoo, TEFAS, truncgil) giden isteklerin tek kapısı.
// Backend'deki fiyat kapısının (internal/services/price_gate.go) karşılığı:
//  - aynı anda gelen aynı istek tek çağrıya iner (cevap herkese kopyalanır),
//  - her kaynağa giden hız sınırlıdır (token bucket), sıra 3 sn'den uzunsa beklemeden hata döner,
//  - kaynak 429 dönerse 5 dk boyunca o kaynağa hiç istek atılmaz.
// Hata fırlatıldığında çağıranların mevcut try/catch'leri kendi yedeklerine (önbellek, backend) düşer.
// Önbellek burada değil, çağıranlarda: onların sembol başına süreli önbellekleri zaten var.

export type HostGroup = 'yahoo' | 'tefas' | 'truncgil' | 'other';

interface GroupLimits {
    perSecond: number;
    burst: number;
}

// Backend kapısı Yahoo'ya ortalama 2/sn gönderiyor; aynı IP'den çıktığımız için ön yüz payı daha küçük.
const LIMITS: Record<Exclude<HostGroup, 'other'>, GroupLimits> = {
    yahoo: { perSecond: 1, burst: 10 },
    tefas: { perSecond: 1 / 3, burst: 2 }, // TEFAS'ın engelleyicisi sıkı
    truncgil: { perSecond: 1, burst: 5 },
};

const MAX_WAIT_MS = 3000;
const BREAKER_MS = 5 * 60 * 1000;
const SHARED_TIMEOUT_MS = 10_000;

// Gövde taşıyamayan durum kodları; Response bunlara gövde verilirse hata fırlatır.
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

export class GateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GateError';
    }
}

export function hostGroup(url: string): HostGroup {
    let host: string;
    try {
        host = new URL(url).hostname;
    } catch {
        return 'other';
    }
    if (host === 'yahoo.com' || host.endsWith('.yahoo.com')) return 'yahoo';
    if (host === 'tefas.gov.tr' || host.endsWith('.tefas.gov.tr')) return 'tefas';
    if (host === 'truncgil.com' || host.endsWith('.truncgil.com')) return 'truncgil';
    return 'other';
}

// Basit token bucket: ortalama gapMs'de bir istek, boştayken burst kadar hak birikir.
// Her gelen bir sonraki boş zamanı ayırır; o zaman çok uzaksa ayırmadan vazgeçer.
class IntervalLimiter {
    private readonly gapMs: number;
    private readonly burstWindowMs: number;
    private next = 0;

    constructor(limits: GroupLimits) {
        this.gapMs = 1000 / limits.perSecond;
        this.burstWindowMs = this.gapMs * Math.max(0, limits.burst - 1);
    }

    /** Beklenecek ms; sıra maxWaitMs'den uzunsa null. */
    reserve(now: number, maxWaitMs: number): number | null {
        const earliest = now - this.burstWindowMs;
        if (this.next < earliest) this.next = earliest;
        const wait = this.next - now;
        if (wait > maxWaitMs) return null;
        this.next += this.gapMs;
        return Math.max(0, wait);
    }
}

interface BufferedResponse {
    status: number;
    statusText: string;
    headers: [string, string][];
    body: ArrayBuffer | null;
}

export interface GateDeps {
    fetchImpl: (input: string, init?: RequestInit) => Promise<Response>;
    now: () => number;
    sleep: (ms: number) => Promise<void>;
}

const defaultDeps: GateDeps = {
    // Next.js global fetch'i açılışta yamalıyor; modül yüklenirken değil, çağrı anında okuyoruz.
    fetchImpl: (input, init) => fetch(input, init),
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function withAbort<T>(p: Promise<T>, signal: AbortSignal | null | undefined): Promise<T> {
    if (!signal) return p;
    if (signal.aborted) return Promise.reject(signal.reason);
    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
        p.then(
            (v) => {
                signal.removeEventListener('abort', onAbort);
                resolve(v);
            },
            (e) => {
                signal.removeEventListener('abort', onAbort);
                reject(e);
            },
        );
    });
}

export function createGate(deps: GateDeps = defaultDeps) {
    const limiters = new Map<HostGroup, IntervalLimiter>();
    const breakerUntil = new Map<HostGroup, number>();
    const inflight = new Map<string, Promise<BufferedResponse>>();

    function limiterFor(group: Exclude<HostGroup, 'other'>): IntervalLimiter {
        let l = limiters.get(group);
        if (!l) {
            l = new IntervalLimiter(LIMITS[group]);
            limiters.set(group, l);
        }
        return l;
    }

    async function run(url: string, init: RequestInit, group: Exclude<HostGroup, 'other'>): Promise<BufferedResponse> {
        if (deps.now() < (breakerUntil.get(group) ?? 0)) {
            throw new GateError(`${group} 429 döndüğü için geçici olarak sorulmuyor`);
        }
        const wait = limiterFor(group).reserve(deps.now(), MAX_WAIT_MS);
        if (wait === null) {
            throw new GateError(`${group} isteği için sıra çok uzun`);
        }
        if (wait > 0) await deps.sleep(wait);

        // Paylaşılan istek tek bir çağıranın iptaline bağlı kalmasın; kendi süre sınırı var.
        const res = await deps.fetchImpl(url, { ...init, signal: AbortSignal.timeout(SHARED_TIMEOUT_MS) });
        if (res.status === 429) {
            breakerUntil.set(group, deps.now() + BREAKER_MS);
            console.warn(`[dış kapı] ${group} 429 döndü, ${BREAKER_MS / 60000} dk istek atılmayacak`);
        }
        const headers: [string, string][] = [];
        res.headers.forEach((value, name) => headers.push([name, value]));
        const body = NULL_BODY_STATUSES.has(res.status) ? null : await res.arrayBuffer();
        return { status: res.status, statusText: res.statusText, headers, body };
    }

    return async function gatedFetch(input: string, init: RequestInit = {}): Promise<Response> {
        const group = hostGroup(input);
        if (group === 'other') return deps.fetchImpl(input, init);

        const method = (init.method ?? 'GET').toUpperCase();
        const bodyKey = typeof init.body === 'string' ? init.body : '';
        const key = `${method} ${input} ${bodyKey}`;

        let shared = inflight.get(key);
        if (!shared) {
            shared = run(input, init, group).finally(() => inflight.delete(key));
            inflight.set(key, shared);
        }

        // Her çağıran kendi süre sınırıyla bekler ve cevabın kendi kopyasını alır (gövde bir kez okunabilir).
        const buffered = await withAbort(shared, init.signal);
        return new Response(buffered.body ? buffered.body.slice(0) : null, {
            status: buffered.status,
            statusText: buffered.statusText,
            headers: buffered.headers,
        });
    };
}

// Uygulamanın tek kapısı. Next.js sunucusu tek süreç olduğu için bütün istekler bu örneği paylaşır.
export const gatedFetch = createGate();
