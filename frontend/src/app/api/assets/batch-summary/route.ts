import { NextResponse } from 'next/server';
import { fetchBatchAssetSummaries } from '@/lib/serverSummary';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assets/batch-summary?symbols=THYAO,ASELS,TUPRS
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const symbolsParam = searchParams.get('symbols') || '';
        const symbols = symbolsParam
            .split(',')
            .map(s => s.trim().toUpperCase())
            .filter(Boolean);

        if (symbols.length === 0) {
            return NextResponse.json({ summaries: {} });
        }

        // Güvenlik: Tek bir istekte en fazla 50 sembol sorgulanabilir
        const cappedSymbols = symbols.slice(0, 50);
        const summaries = await fetchBatchAssetSummaries(cappedSymbols);

        return NextResponse.json(
            { summaries, ...summaries },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
                },
            }
        );
    } catch (error) {
        console.error('Batch summary GET error:', error);
        return NextResponse.json({ summaries: {}, error: 'Özetler alınamadı' }, { status: 500 });
    }
}

/**
 * POST /api/assets/batch-summary
 * Body: { symbols: ["THYAO", "ASELS", "TUPRS"] }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const rawSymbols = Array.isArray(body?.symbols) ? body.symbols : [];
        const symbols = rawSymbols
            .map((s: unknown) => (typeof s === 'string' ? s.trim().toUpperCase() : ''))
            .filter(Boolean);

        if (symbols.length === 0) {
            return NextResponse.json({ summaries: {} });
        }

        const cappedSymbols = symbols.slice(0, 50);
        const summaries = await fetchBatchAssetSummaries(cappedSymbols);

        return NextResponse.json(
            { summaries, ...summaries },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
                },
            }
        );
    } catch (error) {
        console.error('Batch summary POST error:', error);
        return NextResponse.json({ summaries: {}, error: 'Özetler alınamadı' }, { status: 500 });
    }
}
