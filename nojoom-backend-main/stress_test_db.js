import { pool } from './config/db.js';

async function runStressTest() {
    const CONCURRENT_QUERIES = 200; // More than the 50 connection limit
    const totalRequests = 1000;
    const batchSize = 100;
    
    console.log(`🚀 Starting Database Stress Test...`);
    console.log(`📊 Configuration:`);
    console.log(`   - Connection Limit: 50`);
    console.log(`   - Concurrent Queries: ${CONCURRENT_QUERIES}`);
    console.log(`   - Total Queries: ${totalRequests}`);
    console.log(`-----------------------------------------`);

    const start = Date.now();
    let successCount = 0;
    let errorCount = 0;

    const executeBatch = async (count) => {
        const promises = [];
        for (let i = 0; i < count; i++) {
            promises.push(
                pool.execute('SELECT 1 + 1 AS result')
                    .then(() => { successCount++; })
                    .catch((err) => {
                        errorCount++;
                        if (errorCount < 10) console.error(`❌ Query Error: ${err.message}`);
                    })
            );
        }
        await Promise.all(promises);
    };

    // Run in batches to simulate sustained high load
    for (let i = 0; i < totalRequests; i += CONCURRENT_QUERIES) {
        process.stdout.write(`⏳ Progress: ${i}/${totalRequests} queries...\r`);
        await executeBatch(Math.min(CONCURRENT_QUERIES, totalRequests - i));
    }

    const duration = Date.now() - start;
    const rps = (totalRequests / (duration / 1000)).toFixed(2);

    console.log(`\n\n✅ Stress Test Completed!`);
    console.log(`-----------------------------------------`);
    console.log(`⏱️  Total Duration: ${duration}ms`);
    console.log(`📈 Throughput: ${rps} queries/sec`);
    console.log(`✔️  Successful Queries: ${successCount}`);
    console.log(`❌ Failed Queries: ${errorCount}`);
    
    if (errorCount === 0) {
        console.log(`\n🏆 RESULT: The pool handled ${CONCURRENT_QUERIES} concurrent requests perfectly with 50 connections.`);
        console.log(`💡 The 'waitForConnections: true' setting correctly queued the remaining requests.`);
    } else {
        console.log(`\n⚠️  RESULT: The pool encountered errors under high load. Consider increasing connectionLimit or checking database max_connections.`);
    }

    process.exit(errorCount === 0 ? 0 : 1);
}

runStressTest().catch(err => {
    console.error('Fatal Error during test:', err);
    process.exit(1);
});
