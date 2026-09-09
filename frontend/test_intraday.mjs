import YahooFinance from 'yahoo-finance2';
async function test() {
    try {
        const yf = new YahooFinance();
        const today = new Date();
        let startDate = new Date();
        startDate.setMonth(today.getMonth() - 3);
        
        const res = await yf.chart('THYAO.IS', { period1: startDate.toISOString().split('T')[0], interval: '60m' });
        console.log("3M 60m length:", res.quotes.length);
        console.log("sample 60m:", res.quotes[0]);
    } catch(e) {
        console.error("Error:", e);
    }
}
test();
