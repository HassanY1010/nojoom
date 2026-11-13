// config/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DB_HOST = process.env.DB_HOST || process.env.MYSQLHOST;
const DB_USER = process.env.DB_USER || process.env.MYSQLUSER;
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD;
const DB_NAME = process.env.DB_NAME || process.env.MYSQLDATABASE;
const DB_PORT = process.env.DB_PORT || process.env.MYSQLPORT || 3306;

if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
  console.error("❌ Missing required database environment variables (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME or Railway MYSQL* vars)");
  process.exit(1);
}

const dbConfig = {
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  port: parseInt(DB_PORT, 10),
  waitForConnections: true,
  connectionLimit: 50, // ✅ تم الرفع لزيادة السرعة والتعامل مع ضغط المستخدمين
  queueLimit: 0
};

export const pool = mysql.createPool(dbConfig);

// ✅ ربط وقياس أداء استعلامات قاعدة البيانات وتتبع الأخطاء تلقائياً
const originalQuery = pool.query;
const originalExecute = pool.execute;

const wrapQueryMethod = (originalMethod) => {
  return async function (...args) {
    const start = Date.now();
    try {
      const result = await originalMethod.apply(this, args);
      const duration = Date.now() - start;
      // تسجيل القياسات
      import('../services/monitoringService.js').then(({ monitoringService }) => {
        monitoringService.recordDatabaseQuery(duration);
      }).catch(() => {});
      return result;
    } catch (error) {
      // تسجيل الاستثناء في Sentry
      import('../services/monitoringService.js').then(({ monitoringService }) => {
        monitoringService.captureException(error, { query: args[0], params: args[1] });
      }).catch(() => {});
      throw error;
    }
  };
};

pool.query = wrapQueryMethod(originalQuery);
pool.execute = wrapQueryMethod(originalExecute);

// دالة تنفيذ الاستعلامات للإستخدام في الكونترولر
export const executeQuery = async (query, params = []) => {
  try {
    const [results] = await pool.execute(query, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

export const initializeDatabase = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('✅ Connected to MySQL database');

    // 1. إنشاء جدول المستأجرين (Tenants) أولاً
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tenants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subdomain VARCHAR(100) NOT NULL UNIQUE,
        custom_domain VARCHAR(255) DEFAULT NULL UNIQUE,
        subscription_plan ENUM('basic', 'pro', 'enterprise') DEFAULT 'basic',
        storage_limit_gb INT DEFAULT 10,
        storage_used_gb DECIMAL(10,2) DEFAULT 0.00,
        bandwidth_limit_gb INT DEFAULT 100,
        bandwidth_used_gb DECIMAL(10,2) DEFAULT 0.00,
        max_users INT DEFAULT 100,
        is_active TINYINT(1) DEFAULT 1,
        is_trial TINYINT(1) DEFAULT 0,
        trial_ends_at DATETIME DEFAULT NULL,
        settings JSON DEFAULT NULL,
        branding JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_subdomain (subdomain),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 1.5 Multi-Tenant Infrastructure Tables
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        price_monthly DECIMAL(10,2) DEFAULT 0.00,
        price_yearly DECIMAL(10,2) DEFAULT 0.00,
        storage_limit_gb INT NOT NULL,
        max_users INT NOT NULL,
        features JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tenant_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        plan_id INT NOT NULL,
        status ENUM('active', 'inactive', 'canceled', 'expired') DEFAULT 'active',
        current_period_start DATETIME NOT NULL,
        current_period_end DATETIME NOT NULL,
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_role_tenant (tenant_id, slug),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS feature_flags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        feature_key VARCHAR(100) NOT NULL,
        is_enabled BOOLEAN DEFAULT TRUE,
        config JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_feature_tenant (tenant_id, feature_key),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Seed default subscription plans
    const [plans] = await connection.execute('SELECT id FROM subscription_plans LIMIT 1');
    if (plans.length === 0) {
      console.log('➕ Seeding default subscription plans...');
      await connection.execute(`
        INSERT INTO subscription_plans (name, slug, storage_limit_gb, max_users) VALUES 
        ('Basic', 'basic', 10, 100),
        ('Pro', 'pro', 50, 500),
        ('Enterprise', 'enterprise', 500, 5000)
      `);
    }

    // إضافة مستأجر افتراضي إذا لم يوجد
    const [tenants] = await connection.execute('SELECT id FROM tenants LIMIT 1');
    if (tenants.length === 0) {
      console.log('➕ Adding default tenant...');
      await connection.execute(`
        INSERT INTO tenants (name, subdomain, subscription_plan, is_active) 
        VALUES ('Default', 'default', 'enterprise', 1)
      `);

      // Link default tenant to enterprise plan
      const [enterprisePlan] = await connection.execute('SELECT id FROM subscription_plans WHERE slug = "enterprise" LIMIT 1');
      if (enterprisePlan.length > 0) {
        const now = new Date();
        const nextYear = new Date();
        nextYear.setFullYear(now.getFullYear() + 1);

        await connection.execute(`
          INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
          VALUES (1, ?, 'active', ?, ?)
        `, [enterprisePlan[0].id, now, nextYear]);
      }
    }

    // ✅ تحديث جدول المستخدمين
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL DEFAULT 1,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar VARCHAR(255) DEFAULT '/uploads/avatars/default-avatar.png',
        bio TEXT,
        social_links JSON,
        role ENUM('super_admin', 'admin', 'moderator', 'user') DEFAULT 'user',
        email_verified BOOLEAN DEFAULT TRUE,
        language ENUM('en', 'ar') DEFAULT 'en',
        theme ENUM('light', 'dark') DEFAULT 'dark',
        followers_count INT DEFAULT 0,
        following_count INT DEFAULT 0,
        likes_count INT DEFAULT 0,
        views_count INT DEFAULT 0,
        total_watch_time INT DEFAULT 0,
        birth_date DATE,
        birth_day INT,
        birth_month INT,
        birth_year INT,
        is_banned BOOLEAN DEFAULT FALSE,
        ban_reason TEXT,
        deleted_by_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        UNIQUE KEY unique_username_tenant (username, tenant_id),
        UNIQUE KEY unique_email_tenant (email, tenant_id),
        INDEX idx_username (username),
        INDEX idx_email (email),
        INDEX idx_is_banned (is_banned)
      )


    `);

    // 2. مسح شامل وسيدينج (Seeding) للحسابات التجريبية
    const [existingTestUsers] = await connection.execute('SELECT id FROM users WHERE email LIKE "%@test.com" LIMIT 1');
    if (existingTestUsers.length === 0) {
      console.log('🧹 Wiping all users and seeding test accounts...');

      // مسح جميع المستخدمين (سوف يحذف البيانات المرتبطة تلقائياً إذا كان الـ CASCADE مفعل)
      await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
      await connection.execute('TRUNCATE TABLE users');
      await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

      const testPassword = '$2a$10$wH6R7OQuisG7Uj.0xQyO1.g7.z7uS7XUjG6yv4Qz2zB2zB2zB2zB2'; // 'password123'

      const testAccounts = [
        ['super_admin_test', 'super@test.com', testPassword, 'super_admin'],
        ['admin_test', 'admin@test.com', testPassword, 'admin'],
        ['mod_test', 'mod@test.com', testPassword, 'moderator'],
        ['user_test', 'user@test.com', testPassword, 'user']
      ];

      for (const [username, email, password, role] of testAccounts) {
        await connection.execute(
          'INSERT INTO users (username, email, password, role, tenant_id, email_verified) VALUES (?, ?, ?, ?, ?, ?)',
          [username, email, password, role, 1, 1]
        );
      }
      console.log('✅ Test accounts seeded successfully');
    }

    // ✅ دالة محسنة لإضافة الأعمدة مع التحقق من وجودها أولاً
    const addCol = async (tableName, colName, colDef) => {
      try {
        // التحقق من وجود العمود
        const [columns] = await connection.execute(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = ? 
           AND COLUMN_NAME = ?`,
          [tableName, colName]
        );

        if (columns.length === 0) {
          console.log(`➕ Adding column ${colName} to ${tableName}...`);
          await connection.execute(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef}`);
          console.log(`✅ Column ${colName} added successfully`);
        }
      } catch (e) {
        console.error(`❌ Error adding column ${colName} to ${tableName}:`, e.message);
      }
    };

    await addCol('users', 'is_private', 'BOOLEAN DEFAULT FALSE');
    await addCol('users', 'allow_dms', 'BOOLEAN DEFAULT TRUE');
    await addCol('users', 'show_activity_status', 'BOOLEAN DEFAULT TRUE');
    await addCol('users', 'otp_code', 'VARCHAR(6)');
    await addCol('users', 'otp_expires', 'TIMESTAMP NULL');
    await addCol('users', 'points', 'DECIMAL(15,2) DEFAULT 0.00');
    await addCol('users', 'total_earnings', 'DECIMAL(15,2) DEFAULT 0.00');
    await addCol('users', 'country', "VARCHAR(50) DEFAULT 'Global'");

    // ✅ إنشاء جدول reset_codes لإعادة تعيين كلمة المرور
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS reset_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_code (code),
        INDEX idx_expires_at (expires_at)
      )
    `);

    // إنشاء جدول لتخزين توكنات التحقق من البريد الإلكتروني
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token),
        INDEX idx_user_id (user_id)
      )
    `);

    // ✅ جدول البث الإداري
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS broadcasts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_created_at (created_at)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS broadcast_displays (
        id INT AUTO_INCREMENT PRIMARY KEY,
        broadcast_id INT NOT NULL,
        user_id INT NOT NULL,
        display_count INT DEFAULT 1,
        displayed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_broadcast_user (broadcast_id, user_id),
        INDEX idx_broadcast_id (broadcast_id)
      )
    `);

    // ✅ تحديث جدول الفيديوهات بشكل كامل
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        path VARCHAR(255) NOT NULL,
        description TEXT,
        hashtags JSON,
        is_public BOOLEAN DEFAULT TRUE,
        is_chat_video BOOLEAN DEFAULT FALSE,
        views INT DEFAULT 0,
        likes INT DEFAULT 0,
        duration INT DEFAULT 0,
        deleted_by_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_is_public (is_public),
        INDEX idx_created_at (created_at),
        INDEX idx_deleted_by_admin (deleted_by_admin)
      )
    `);

    // ✅ إضافة أعمدة إضافية للفيديوهات
    await addCol('videos', 'shares', 'INT DEFAULT 0');
    await addCol('videos', 'thumbnail', 'VARCHAR(255)');
    await addCol('videos', 'title', "VARCHAR(255) DEFAULT 'بدون عنوان'");
    await addCol('videos', 'video_url', 'VARCHAR(255)');
    await addCol('videos', 'url', 'VARCHAR(255)');
    await addCol('videos', 'subspace_video_id', 'VARCHAR(255)');
    await addCol('videos', 'subspace_thumbnail_id', 'VARCHAR(255)');
    await addCol('videos', 'pinned_at', 'TIMESTAMP NULL');
    await addCol('videos', 'is_pinned', 'BOOLEAN DEFAULT FALSE');
    await addCol('videos', 'deletion_reason', 'TEXT');
    await addCol('videos', 'deleted_at', 'TIMESTAMP NULL');
    await addCol('videos', 'boost_score', 'INT DEFAULT 0');
    await addCol('videos', 'country', "VARCHAR(50) DEFAULT 'Global'");
    await addCol('videos', 'ai_title_suggestion', 'VARCHAR(255)');
    await addCol('videos', 'ai_moderation_score', 'DECIMAL(3,2) DEFAULT 0.00');
    await addCol('videos', 'ai_moderation_flags', 'JSON');
    await addCol('videos', 'subtitles_path', 'VARCHAR(255)');
    await addCol('videos', 'ai_transcription', 'TEXT');
    await addCol('videos', 'group_id', 'INT');

    // ✅ جدول تفضيلات المستخدم (User Preferences) - للتوصيات
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNIQUE NOT NULL,
        preferred_categories JSON,
        excluded_users JSON,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id)
      )
    `);

    // ✅ جدول الرسائل الخاصة (Direct Messages)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_sender_id (sender_id),
        INDEX idx_receiver_id (receiver_id),
        INDEX idx_created_at (created_at),
        INDEX idx_is_read (is_read)
      )
    `);

    await addCol('direct_messages', 'message_type', "ENUM('text', 'voice') DEFAULT 'text'");
    await addCol('direct_messages', 'media_url', 'VARCHAR(255)');

    // ✅ إنشاء جدول المحادثات النشطة
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS active_conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user1_id INT NOT NULL,
        user2_id INT NOT NULL,
        last_message_id INT,
        last_message_content TEXT,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unread_count INT DEFAULT 0,
        FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (last_message_id) REFERENCES direct_messages(id) ON DELETE SET NULL,
        UNIQUE KEY unique_conversation (user1_id, user2_id),
        INDEX idx_user1_id (user1_id),
        INDEX idx_user2_id (user2_id),
        INDEX idx_last_message_at (last_message_at)
      )
    `);

    // ✅ جدول مشاهدات الفيديو
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS video_views (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        video_id INT NOT NULL,
        source VARCHAR(50) DEFAULT 'explore',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX idx_video_id (video_id),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول مشاهدات الـ Explore
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS explore_views (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        video_id INT NOT NULL,
        source VARCHAR(50) DEFAULT 'explore',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول المتابعات
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS follows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        follower_id INT NOT NULL,
        following_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_follow (follower_id, following_id),
        INDEX idx_follower_id (follower_id),
        INDEX idx_following_id (following_id)
      )
    `);

    // ✅ جدول الإعجابات
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        UNIQUE KEY unique_like (user_id, video_id),
        INDEX idx_user_id (user_id),
        INDEX idx_video_id (video_id)
      )
    `);

    // ✅ جدول التعليقات
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX idx_video_id (video_id),
        INDEX idx_created_at (created_at)
      )
    `);
    await addCol('comments', 'video_reply_id', 'INT');

    // ✅ جدول الرسائل (للفيديو/الشات العام)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT,
        video_id INT,
        content TEXT NOT NULL,
        type ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS message_displays (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        display_count INT DEFAULT 1,
        displayed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_message_user (message_id, user_id),
        INDEX idx_message_id (message_id),
        INDEX idx_user_id (user_id)
      )
    `);

    // ✅ جدول سجل المشاهدة
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS watch_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT NOT NULL,
        watch_time INT DEFAULT 0,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_video (user_id, video_id),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ إضافة عمود last_position لسجل المشاهدة
    await addCol('watch_history', 'last_position', 'DECIMAL(10,2) DEFAULT 0');

    // ✅ جدول تفاعلات المستخدم
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_interactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT,
        interaction_type ENUM('like', 'share', 'watch_complete', 'watch_partial', 'follow', 'comment', 'report', 'view') NOT NULL,
        weight DECIMAL(3,2) DEFAULT 1.0,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_video_id (video_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول refresh tokens
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token)
      )
    `);

    // ✅ جدول سجل البحث
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS search_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        query VARCHAR(255) NOT NULL,
        search_type VARCHAR(50) DEFAULT 'all',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول تفاعلات البحث
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS search_interactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT,
        interaction_type VARCHAR(50) NOT NULL,
        weight DECIMAL(3,2) DEFAULT 1.0,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_video_id (video_id)
      )
    `);

    // ✅ جدول تتبع حركة العين (Eye Tracking)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS eye_tracking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT NOT NULL,
        gaze_points JSON,
        attention_score DECIMAL(5,2) DEFAULT 0,
        focus_duration INT DEFAULT 0,
        viewport_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX idx_user_video (user_id, video_id),
        INDEX idx_created_at (created_at),
        INDEX idx_attention_score (attention_score)
      )
    `);

    // ✅ جدول تتبع سلوك التمرير (Scroll Behavior)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS scroll_behavior (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT NOT NULL,
        scroll_speed DECIMAL(8,2) DEFAULT 0,
        scroll_pattern VARCHAR(50),
        pause_duration INT DEFAULT 0,
        engagement_score DECIMAL(5,2) DEFAULT 0,
        swipe_direction VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_video_id (video_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول التفاعل الصوتي (Voice Interactions)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS voice_interactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT NOT NULL,
        interaction_type VARCHAR(50) DEFAULT 'reaction',
        duration INT DEFAULT 0,
        intensity DECIMAL(5,2) DEFAULT 0,
        timestamp_in_video INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_video_id (video_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول ملفات المستخدم AI (AI User Profiles)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ai_user_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNIQUE NOT NULL,
        eye_tracking_enabled BOOLEAN DEFAULT FALSE,
        voice_tracking_enabled BOOLEAN DEFAULT FALSE,
        scroll_tracking_enabled BOOLEAN DEFAULT TRUE,
        profile_data JSON,
        preferences JSON,
        total_ai_score DECIMAL(8,2) DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id)
      )
    `);

    // ✅ جدول بيانات التدريب AI (AI Training Data)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ai_training_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT NOT NULL,
        interaction_data JSON,
        prediction_score DECIMAL(5,2),
        actual_engagement DECIMAL(5,2),
        accuracy DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول أجزاء الفيديو (Video Chunks) - للمحرك الفائق
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS video_chunks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        video_id INT NOT NULL,
        quality ENUM('360p', '480p', '720p') NOT NULL,
        chunk_index INT NOT NULL,
        chunk_path VARCHAR(255) NOT NULL,
        duration DECIMAL(5,2),
        file_size INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX idx_video_quality (video_id, quality),
        INDEX idx_chunk_index (chunk_index)
      )
    `);

    // ✅ جدول ملفات Manifest للفيديو (HLS)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS video_manifests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        video_id INT NOT NULL,
        manifest_path VARCHAR(255) NOT NULL,
        total_chunks INT DEFAULT 0,
        processing_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        UNIQUE KEY unique_video (video_id),
        INDEX idx_processing_status (processing_status)
      )
    `);

    // ✅ جدول التحديات الأسبوعية (Weekly Challenges)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS challenges (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        title_ar VARCHAR(255) NOT NULL,
        description TEXT,
        description_ar TEXT,
        type ENUM('10_second_video', 'best_editing', 'best_comment') NOT NULL,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        status ENUM('active', 'ended', 'archived') DEFAULT 'active',
        winner_id INT,
        winner_announced_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_type (type),
        INDEX idx_dates (start_date, end_date)
      )
    `);

    // ✅ جدول مشاركات التحديات (Challenge Entries)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS challenge_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        challenge_id INT NOT NULL,
        user_id INT NOT NULL,
        video_id INT,
        comment_id INT,
        engagement_score DECIMAL(10,2) DEFAULT 0,
        submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_challenge (user_id, challenge_id),
        INDEX idx_challenge_id (challenge_id),
        INDEX idx_user_id (user_id),
        INDEX idx_engagement_score (engagement_score)
      )
    `);

    // ✅ جدول أوسمة المستخدمين (User Badges)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_badges (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        badge_type ENUM('10_second_winner', 'editing_winner', 'comment_winner') NOT NULL,
        challenge_id INT NOT NULL,
        awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_badge_type (badge_type)
      )
    `);

    // ✅ جدول الرسائل المتحركة (Animated Messages)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS animated_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        content TEXT NOT NULL,
        animation_type ENUM('fade', 'slide', 'bounce', 'glow') DEFAULT 'fade',
        color VARCHAR(50) DEFAULT '#FFD700',
        is_active BOOLEAN DEFAULT TRUE,
        views_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NULL,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_sender_id (sender_id),
        INDEX idx_is_active (is_active),
        INDEX idx_created_at (created_at)
      )
    `);

    // ✅ جدول مشاركات الفيديو (Video Shares)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS video_shares (
        id INT AUTO_INCREMENT PRIMARY KEY,
        video_id INT NOT NULL,
        user_id INT NOT NULL,
        share_method VARCHAR(50) DEFAULT 'direct',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_video_id (video_id),
        INDEX idx_user_id (user_id)
      )
    `);

    // ✅ جدول إعدادات النظام
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT PRIMARY KEY DEFAULT 1,
        maintenance_mode BOOLEAN DEFAULT FALSE,
        chat_enabled BOOLEAN DEFAULT TRUE,
        upload_enabled BOOLEAN DEFAULT TRUE,
        user_registration_enabled BOOLEAN DEFAULT TRUE,
        max_video_size BIGINT DEFAULT 104857600,
        max_video_duration INT DEFAULT 300,
        auto_ban_reports_threshold INT DEFAULT 5,
        allowed_video_formats VARCHAR(255) DEFAULT 'mp4,mov,avi',
        featured_hashtags TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await addCol('system_settings', 'featured_hashtags', 'TEXT');

    // ✅ جدول البث المباشر (Live Streams)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS live_streams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        host_id INT NOT NULL,
        title VARCHAR(255) DEFAULT 'بث مباشر',
        status ENUM('active', 'ended') DEFAULT 'active',
        viewers_count INT DEFAULT 0,
        likes_count INT DEFAULT 0,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP NULL,
        FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_host_id (host_id),
        INDEX idx_status (status)
      )
    `);

    // ✅ جدول الهدايا (Live Gifts)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS live_gifts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        live_id INT NOT NULL,
        sender_id INT NOT NULL,
        gift_type ENUM('rose', 'heart', 'star', 'crown', 'diamond') NOT NULL,
        amount INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (live_id) REFERENCES live_streams(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_live_id (live_id)
      )
    `);

    // ✅ جدول المجموعات (Social Groups)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`groups\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        avatar VARCHAR(255) DEFAULT '/uploads/groups/default-group.png',
        creator_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_name (name)
      )
    `);

    // ✅ جدول أعضاء المجموعات
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS group_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('member', 'admin') DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_member (group_id, user_id),
        INDEX idx_group_id (group_id),
        INDEX idx_user_id (user_id)
      )
    `);

    // ✅ جدول القصص (Stories)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS stories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        media_url VARCHAR(255) NOT NULL,
        media_type ENUM('image', 'video') DEFAULT 'video',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        views_count INT DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_expires_at (expires_at)
      )
    `);

    // ✅ جدول الاشتراكات لإشعارات ويب بوش (Push Subscriptions)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        subscription_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id)
      )
    `);

    // ✅ جدول رموز Firebase لإشعارات الهاتف الذكي (FCM Tokens)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS fcm_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        fcm_token VARCHAR(255) NOT NULL,
        device_type VARCHAR(50) DEFAULT 'web',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        UNIQUE INDEX idx_token (fcm_token)
      )
    `);

    // ✅ جدول تحليلات الاستخدام والإحصائيات (Usage Metrics)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS usage_metrics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL DEFAULT 1,
        metric_date DATE NOT NULL,
        storage_used_gb DOUBLE DEFAULT 0,
        bandwidth_used_gb DOUBLE DEFAULT 0,
        active_users INT DEFAULT 0,
        mau INT DEFAULT 0,
        total_videos INT DEFAULT 0,
        total_views INT DEFAULT 0,
        avg_watch_time DOUBLE DEFAULT 0,
        engagement_rate DOUBLE DEFAULT 0,
        retention_d1 DOUBLE DEFAULT 0,
        retention_d7 DOUBLE DEFAULT 0,
        retention_d30 DOUBLE DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY tenant_date (tenant_id, metric_date),
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_metric_date (metric_date)
      )
    `);

    // ✅ ضمان وجود عمود tenant_id في جميع الجداول (للمشاريع القائمة)
    const tablesToUpdate = [
      'users', 'reset_codes', 'email_verification_tokens', 'broadcasts',
      'broadcast_displays', 'videos', 'user_preferences', 'direct_messages',
      'active_conversations', 'video_views', 'explore_views', 'follows',
      'likes', 'comments', 'messages', 'message_displays', 'watch_history',
      'user_interactions', 'refresh_tokens', 'search_history', 'search_interactions',
      'eye_tracking', 'scroll_behavior', 'voice_interactions', 'ai_user_profiles',
      'ai_training_data', 'video_chunks', 'video_manifests', 'challenges',
      'challenge_entries', 'user_badges', 'animated_messages', 'video_shares',
      'system_settings', 'live_streams', 'live_gifts', 'groups', 'group_members', 'stories',
      'push_subscriptions', 'fcm_tokens', 'usage_metrics'
    ];

    for (const table of tablesToUpdate) {
      await addCol(table, 'tenant_id', 'INT NOT NULL DEFAULT 1');
      // إضافة Index إذا لم يوجد
      try {
        await connection.execute(`ALTER TABLE ${table} ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id)`);
      } catch (e) { /* ignore */ }
    }

    // ✅ إضافة فهارس البحث النصي الكامل (FULLTEXT Indexes) للبحث فائق السرعة
    try {
      await connection.execute(`ALTER TABLE videos ADD FULLTEXT INDEX IF NOT EXISTS ft_video_search (title, description)`);
    } catch (e) { /* ignore */ }

    try {
      await connection.execute(`ALTER TABLE users ADD FULLTEXT INDEX IF NOT EXISTS ft_user_search (username, bio)`);
    } catch (e) { /* ignore */ }

    console.log('✅ All tables ready');
  } catch (error) {
    console.error('❌ DB init error:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export default { pool, executeQuery, initializeDatabase };