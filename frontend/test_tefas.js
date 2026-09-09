const { Tefas } = require('@firstthumb/tefas-api');
async function run() {
    const t = new Tefas();
    try {
        const data = await t.getMergedData('2024-08-01', '2024-09-09', 'YAS');
        console.log(data);
    } catch(e) {
        console.error(e);
    }
}
run();
