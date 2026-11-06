// Çalıştırma: npm run test:gate  (Node'un kendi test koşucusu, ek bağımlılık yok)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGate, GateError, hostGroup, type GateDeps } from './externalGate.ts';

function fakeDeps(handler: (url: string, init?: RequestInit) => Promise<Response>) {
    let clock = 1_000_000;
    let calls = 0;
    const deps: GateDeps = {
        fetchImpl: async (url, init) => {
            calls++;
            return handler(url, init);
        },
        now: () => clock,
        // Saat yalnızca testin advance() çağrısıyla ilerler; aynı anda gelen istekler aynı "şimdi"yi görür.
        sleep: async () => {},
    };
    return {
        deps,
        calls: () => calls,
        advance: (ms: number) => {
            clock += ms;
        },
    };
}

const later = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('host grupları', () => {
    assert.equal(hostGroup('https://query1.finance.yahoo.com/v8/finance/chart/THYAO.IS'), 'yahoo');
    assert.equal(hostGroup('https://fc.yahoo.com'), 'yahoo');
    assert.equal(hostGroup('https://www.tefas.gov.tr/api/funds/x'), 'tefas');
    assert.equal(hostGroup('https://finans.truncgil.com/v4/today.json'), 'truncgil');
    assert.equal(hostGroup('http://api:8080/v1/assets'), 'other');
    assert.equal(hostGroup('https://notyahoo.com.evil.example/x'), 'other');
});

test('aynı anda gelen 50 aynı istek tek çağrıya iner, herkes gövdeyi okuyabilir', async () => {
    const f = fakeDeps(async () => {
        await later(50);
        return new Response('{"fiyat":296.5}', { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const gatedFetch = createGate(f.deps);

    const results = await Promise.all(
        Array.from({ length: 50 }, () =>
            gatedFetch('https://query1.finance.yahoo.com/v8/finance/chart/THYAO.IS').then((r) => r.json()),
        ),
    );
    assert.equal(f.calls(), 1);
    assert.equal(results.length, 50);
    for (const r of results) assert.equal(r.fiyat, 296.5);
});

test('farklı gövdeli POST istekleri birleşmez', async () => {
    const f = fakeDeps(async () => new Response('[]', { status: 200 }));
    const gatedFetch = createGate(f.deps);
    const url = 'https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir';
    await Promise.all([
        gatedFetch(url, { method: 'POST', body: '{"fonTipi":"YAT"}' }),
        gatedFetch(url, { method: 'POST', body: '{"fonTipi":"EMK"}' }),
    ]);
    assert.equal(f.calls(), 2);
});

test('429 gelince 5 dk boyunca o kaynağa istek atılmaz, diğer kaynaklar etkilenmez', async () => {
    let status = 429;
    const f = fakeDeps(async () => new Response('Too Many Requests', { status }));
    const gatedFetch = createGate(f.deps);

    const first = await gatedFetch('https://query1.finance.yahoo.com/v8/finance/chart/A.IS');
    assert.equal(first.status, 429);

    await assert.rejects(gatedFetch('https://query1.finance.yahoo.com/v8/finance/chart/B.IS'), GateError);
    assert.equal(f.calls(), 1, 'devre açıkken Yahoo çağrılmamalı');

    status = 200;
    await gatedFetch('https://finans.truncgil.com/v4/today.json');
    assert.equal(f.calls(), 2, 'truncgil ayrı kaynak, etkilenmemeli');

    f.advance(5 * 60 * 1000 + 1);
    const again = await gatedFetch('https://query1.finance.yahoo.com/v8/finance/chart/B.IS');
    assert.equal(again.status, 200, 'süre bitince tekrar sorulmalı');
});

test('hız sınırı: biriken hak bitince sıraya girer, sıra 3 sn\'den uzunsa vazgeçer', async () => {
    const f = fakeDeps(async () => new Response('ok', { status: 200 }));
    const gatedFetch = createGate(f.deps);

    // TEFAS: 3 sn'de bir, 2 hak birikir. Aynı anda 4 istek: 1. ve 2. hemen, 3. 3 sn bekler,
    // 4. 6 sn bekleyeceği için (en fazla 3 sn) sıraya girmeden vazgeçer.
    const url = (n: number) => `https://www.tefas.gov.tr/api/funds/x?n=${n}`;
    const results = await Promise.allSettled([1, 2, 3, 4].map((n) => gatedFetch(url(n))));
    assert.deepEqual(
        results.map((r) => r.status),
        ['fulfilled', 'fulfilled', 'fulfilled', 'rejected'],
    );
    assert.ok((results[3] as PromiseRejectedResult).reason instanceof GateError);
    assert.equal(f.calls(), 3);
});

test('çağıranın kendi süre sınırı paylaşılan isteği beklemeyi keser', async () => {
    const f = fakeDeps(async () => {
        await later(300);
        return new Response('geç', { status: 200 });
    });
    const gatedFetch = createGate(f.deps);
    await assert.rejects(
        gatedFetch('https://query1.finance.yahoo.com/v8/finance/chart/X.IS', { signal: AbortSignal.timeout(50) }),
    );
});

test('çerez başlıkları ve gövdesiz durum kodları korunur', async () => {
    const f = fakeDeps(async (url) => {
        if (url.includes('fc.yahoo.com')) {
            return new Response('not found', { status: 404, headers: [['set-cookie', 'A3=abc; Path=/']] });
        }
        return new Response(null, { status: 204 });
    });
    const gatedFetch = createGate(f.deps);

    const r1 = await gatedFetch('https://fc.yahoo.com');
    assert.equal(r1.headers.get('set-cookie'), 'A3=abc; Path=/');
    const r2 = await gatedFetch('https://query2.finance.yahoo.com/v1/test/getcrumb');
    assert.equal(r2.status, 204);
});

test('dış kaynak olmayan adresler kapıdan geçmez', async () => {
    const f = fakeDeps(async () => new Response('backend', { status: 200 }));
    const gatedFetch = createGate(f.deps);
    await Promise.all([gatedFetch('http://api:8080/v1/assets'), gatedFetch('http://api:8080/v1/assets')]);
    assert.equal(f.calls(), 2, 'backend istekleri birleştirilmemeli');
});
