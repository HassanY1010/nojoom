const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function resetVideos() {
    console.log('🔄 Connecting to Aiven to clean up stale video links...');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        ssl: {
            ca: fs.readFileSync(path.join(__dirname, 'ca.pem')),
        },
    });

    try {
        // 1. Delete videos that contain local upload paths (they won't work on Render)
        console.log('🗑️ Deleting videos with local paths...');
        const [result] = await connection.query(`
      DELETE FROM videos 
      WHERE video_url LIKE '/uploads/%' 
         OR video_url LIKE 'uploads/%'
         OR video_url IS NULL
         OR video_url = '/default-video.mp4'
    `);

        console.log(`✅ Deleted ${result.affectedRows} stale video entries.`);
        console.log('✨ Database is now clean and ready for fresh Cloudinary uploads!');

    } catch (err) {
        console.error('❌ Reset failed:', err.message);
    } finally {
        await connection.end();
    }
}

resetVideos();
