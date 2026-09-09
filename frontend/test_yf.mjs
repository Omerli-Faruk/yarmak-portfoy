import { YahooFinance } from 'yahoo-finance2';
async function test() {
    try {
        const yf = new YahooFinance();
        const res = await yf.chart('USDTRY=X', { period1: '2024-08-01', interval: '1d' });
        console.log("Chart length:", res.quotes.length);
    } catch(e) {
        console.error("Error:", e);
    }
}
test();
