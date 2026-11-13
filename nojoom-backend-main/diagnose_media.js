import { pool } from './config/db.js';
import fs from 'fs';
import path from 'path';

async function diagnoseMedia() {
    try {
        const [rows] = await pool.execute('SELECT id, video_url, thumbnail FROM videos ORDER BY id DESC LIMIT 20');
        console.log('--- Media Diagnostics ---');

        for (const row of rows) {
            const videoFilename = path.basename(row.video_url);
            const thumbFilename = path.basename(row.thumbnail);

            const videoPath = path.join(process.cwd(), 'uploads', 'videos', videoFilename);
            const thumbPath = path.join(process.cwd(), 'uploads', 'videos', 'thumbnails', thumbFilename);

            const videoExists = fs.existsSync(videoPath);
            const thumbExists = fs.existsSync(thumbPath);

            console.log(`Video ID ${row.id}:`);
            console.log(`  - Video File: ${videoFilename} [${videoExists ? 'FOUND' : 'MISSING'}]`);
            console.log(`  - Local Path: ${videoPath}`);
            console.log(`  - Thumb File: ${thumbFilename} [${thumbExists ? 'FOUND' : 'MISSING'}]`);
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

diagnoseMedia();
