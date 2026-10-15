// app/api altındaki route'ların ortak yardımcıları. Sadece sunucuda çalışır,
// 'use client' olan dosyalardan import etmeyin.

export const BACKEND_URL =
    process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080/v1';

export interface ChartQuote {
    price: number;
    prev: number;
    change: string; // "+1.25" gibi, nokta ondalıklı ve % işaretsiz
    positive: boolean;
    name: string;
}

export interface BackendAsset {
    ID?: number;
    id?: number;
    Symbol?: string;
    symbol?: string;
    Name?: string;
    name?: string;
    AssetType?: string;
    asset_type?: string;
    CurrentPrice?: string;
    current_price?: string;
    Change?: string | number;
}

// API yanıtlarındaki değişim metni: 1.234 -> "+1.23", -0.5 -> "-0.50"
export function signedChange(value: number): string {
    return (value >= 0 ? '+' : '') + value.toFixed(2);
}

// API yanıtlarındaki fiyat metni: 1 TL altında 4, üstünde 2 ondalık
export function formatApiPrice(price: number): string {
    return price >= 1 ? price.toFixed(2) : price.toFixed(4);
}

// Next.js sunucusu backend'e kendi adresinden bağlandığı için asıl kullanıcının IP'sini
// X-Real-IP başlığıyla iletiyoruz. Backend bu başlığa yalnızca güvendiği proxy adreslerinden
// gelen isteklerde bakar (TRUSTED_PROXIES).
export function clientIpHeader(request: Request): Record<string, string> {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',').pop()?.trim() || request.headers.get('x-real-ip')?.trim();
    return ip ? { 'X-Real-IP': ip } : {};
}

// clientIpHeader'a ek olarak kullanıcının access_token çerezini iletir. Backend yeni sembol eklemeye ve
// geçmiş veri indirmeye yalnızca giriş yapmış kullanıcılar için izin verir.
export function backendAuthHeaders(request: Request): Record<string, string> {
    const headers = clientIpHeader(request);
    const token = request.headers.get('cookie')?.match(/(?:^|;\s*)access_token=([^;]+)/)?.[1];
    if (token) headers['Cookie'] = `access_token=${token}`;
    return headers;
}

const USER_AGENT = { 'User-Agent': 'Mozilla/5.0' };

// Yahoo v7/v10 uçları cookie + crumb ister; ikisini 1 saat saklıyoruz.
let yahooAuthCache: { cookie: string; crumb: string; expiresAt: number } | null = null;

export async function getYahooAuth(timeoutMs = 3500): Promise<{ cookie: string; crumb: string } | null> {
    const now = Date.now();
    if (yahooAuthCache && now < yahooAuthCache.expiresAt) {
        return { cookie: yahooAuthCache.cookie, crumb: yahooAuthCache.crumb };
    }
    try {
        const r1 = await fetch('https://fc.yahoo.com', {
            headers: USER_AGENT,
            signal: AbortSignal.timeout(timeoutMs),
        });
        const cookie = r1.headers.get('set-cookie');
        if (!cookie) return null;

        const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
            headers: { ...USER_AGENT, 'Cookie': cookie },
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!r2.ok) return null;
        const crumb = await r2.text();
        if (!crumb || crumb.includes('Too Many') || crumb.includes('Unauthorized')) return null;

        yahooAuthCache = { cookie, crumb, expiresAt: now + 60 * 60 * 1000 };
        return { cookie, crumb };
    } catch {
        return null;
    }
}

// Yahoo v8 chart ucundan son fiyat ve önceki kapanışa göre değişim.
// range '1d' iken chartPreviousClose bir önceki seansın kapanışıdır; '5d' beş seans öncesini verir.
export async function fetchYahooChart(
    ticker: string,
    opts: { range?: '1d' | '5d'; timeoutMs?: number; name?: string } = {}
): Promise<ChartQuote | null> {
    const { range = '1d', timeoutMs = 3500, name } = opts;
    try {
        const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${range}`,
            {
                headers: USER_AGENT,
                signal: AbortSignal.timeout(timeoutMs),
            }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta || !meta.regularMarketPrice) return null;

        const price = Number(meta.regularMarketPrice);
        const prev = Number(meta.chartPreviousClose || meta.previousClose || price);
        const pct = prev > 0 ? ((price - prev) / prev) * 100 : 0;

        return {
            price,
            prev,
            change: signedChange(pct),
            positive: pct >= 0,
            name: name || meta.longName || meta.shortName || ticker,
        };
    } catch {
        return null;
    }
}

// Bir onsun gram karşılığı
const GRAMS_PER_OUNCE = 31.1034768;

// Gram altın alınamazsa ons fiyatından hesaplanır: ons * USDTRY / 31,1034768
export function gramGoldFromOunce(goldOz: ChartQuote | null, usdTry: ChartQuote | null): ChartQuote | null {
    if (!goldOz || !usdTry || goldOz.price <= 0 || usdTry.price <= 0) return null;
    const price = (goldOz.price * usdTry.price) / GRAMS_PER_OUNCE;
    const prev = (goldOz.prev * usdTry.prev) / GRAMS_PER_OUNCE;
    const pct = prev > 0 ? ((price - prev) / prev) * 100 : 0;
    return {
        price,
        prev,
        change: signedChange(pct),
        positive: pct >= 0,
        name: 'Gram Altın',
    };
}

// Gram altın (serbest piyasa) fiyatı truncgil'den
export async function fetchSpotGold(timeoutMs = 3500): Promise<ChartQuote | null> {
    try {
        const res = await fetch('https://finans.truncgil.com/v4/today.json', {
            headers: USER_AGENT,
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) return null;
        const text = await res.text();
        const m = text.match(/"GRA"\s*:\s*(\{[^}]+\})/);
        if (!m) return null;

        const gra = JSON.parse(m[1]);
        const price = Number(gra.Selling || gra.Buying || 0);
        if (price <= 0) return null;

        const changePct = Number(gra.Change || 0);
        const prev = price / (1 + changePct / 100);

        return {
            price,
            prev,
            change: signedChange(changePct),
            positive: changePct >= 0,
            name: 'Gram Altın',
        };
    } catch {
        return null;
    }
}
