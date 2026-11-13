import { pool } from './config/db.js';

async function checkPaths() {
    try {
        const [rows] = await pool.execute('SELECT id, video_url, thumbnail, path FROM videos ORDER BY id DESC LIMIT 5');
        console.log('--- Video Paths ---');
        console.table(rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkPaths();
