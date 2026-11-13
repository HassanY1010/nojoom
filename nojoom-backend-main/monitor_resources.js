import http from 'http';
import os from 'os';

// Config
const SERVER_URL = 'http://localhost:3333';
const CONCURRENT_REQUESTS = 50;
const TOTAL_REQUESTS = 500;
const ENDPOINT = '/api/health';

function getResourceUsage() {
    const mem = process.memoryUsage();
    return {
        rss: (mem.rss / 1024 / 1024).toFixed(2) + ' MB',
        heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        external: (mem.external / 1024 / 1024).toFixed(2) + ' MB',
        cpu: process.cpuUsage(),
        systemFreeMem: (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + ' GB'
    };
}

async function sendRequest() {
    return new Promise((resolve) => {
        http.get(`${SERVER_URL}${ENDPOINT}`, (res) => {
            res.on('data', () => {}); // Consume data
            res.on('end', () => resolve(true));
        }).on('error', (err) => {
            resolve(false);
        });
    });
}

async function runTest() {
    console.log(`🚀 Starting Server Resource Test...`);
    console.log(`📊 Targets: ${TOTAL_REQUESTS} requests, ${CONCURRENT_REQUESTS} concurrency`);
    
    console.log('\n--- Initial Resources ---');
    console.table(getResourceUsage());

    const start = Date.now();
    let successCount = 0;
    let failCount = 0;

    // Run batches
    for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENT_REQUESTS) {
        const batch = [];
        for (let j = 0; j < CONCURRENT_REQUESTS && (i + j) < TOTAL_REQUESTS; j++) {
            batch.push(sendRequest().then(ok => {
                if (ok) successCount++;
                else failCount++;
            }));
        }
        await Promise.all(batch);
        process.stdout.write(`⏳ Progress: ${i + CONCURRENT_REQUESTS}/${TOTAL_REQUESTS} requests...\r`);
    }

    const duration = Date.now() - start;
    
    console.log('\n\n--- Final Resources (After Load) ---');
    console.table(getResourceUsage());

    console.log(`\n✅ Resource Test Completed!`);
    console.log(`-----------------------------------------`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`✔️  Successful Requests: ${successCount}`);
    console.log(`❌ Failed Requests: ${failCount} (Ensure server is running!)`);
    
    if (successCount === 0) {
        console.log(`\n⚠️  WARNING: Could not connect to server at ${SERVER_URL}. Please make sure 'npm start' or 'node server.js' is running in another terminal.`);
    } else {
        console.log(`\n🏆 Stability Score: ${(successCount/TOTAL_REQUESTS*100).toFixed(0)}%`);
    }
    
    process.exit(0);
}

runTest().catch(console.error);
