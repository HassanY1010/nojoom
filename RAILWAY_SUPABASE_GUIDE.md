# دليل الرفع الكامل لمنصة نجوم (Nojoom) على Railway و Supabase Storage

هذا الدليل يشرح خطوة بخطوة كيفية رفع المنصة بالكامل:
1. **قاعدة البيانات (MySQL)** على Railway
2. **الذاكرة المؤقتة والطوابير (Redis)** على Railway
3. **الواجهة الخلفية (Backend API)** على Railway
4. **الواجهة الأمامية (Frontend App)** على Railway
5. **تخزين الوسائط (فيديوهات، صور مصغرة، صور شخصية، ستوريات)** على **Supabase Storage** عبر بروتوكول S3 المتوافق

---

## الخطوة 1: إعداد التخزين على Supabase Storage

### 1. إنشاء الحاوية (Bucket):
1. ادخل إلى لوحة تحكم [Supabase Dashboard](https://supabase.com/dashboard).
2. اختر مشروعك (أو أنشئ مشروعاً جديداً مجانياً).
3. من القائمة الجانبية، اضغط على **Storage**.
4. اضغط على **New Bucket**:
   - الاسم: `nojoom-media`
   - تفعيل خيار: **Public Bucket** (ضروري ليتمكن المستخدمون من تشغيل الفيديوهات وعرض الصور).
   - اضغط **Save**.

### 2. استخراج مفاتيح الوصول S3 (S3 Access Keys):
1. من القائمة الجانبية في Supabase، اضغط على أيقونة الإعدادات **Project Settings** (الترس أسفل اليسار).
2. اختر **Storage** من قائمة الإعدادات.
3. توجه إلى قسم **S3 Access Keys** واضغط على **New access key**.
4. سيظهر لك:
   - **Endpoint**: رابط الـ S3 (شكله: `https://<PROJECT-REF>.supabase.co/storage/v1/s3`)
   - **Access Key ID**: المفتاح العام
   - **Secret Access Key**: المفتاح السري (انسخه فوراً لأنه يظهر لمرة واحدة)
   - **Region**: عادةً منطقة مشروعك (مثل: `us-east-1` أو `eu-central-1`)
5. رابط الوسائط العام (Public Base URL) سيكون:
   `https://<PROJECT-REF>.supabase.co/storage/v1/object/public/nojoom-media`

---

## الخطوة 2: إنشاء مشروع Railway وإضافة الخدمات الأساسية

1. ادخل إلى [Railway.app](https://railway.app) وسجل دخولك.
2. اضغط على **+ New Project**.

### أ. إضافة قاعدة بيانات MySQL:
1. اضغط **+ New** ثم **Database** ثم اختر **Add MySQL**.
2. سيقوم Railway بإنشاء قاعدة البيانات تلقائياً وتوليد المتغيرات البيئية الخاصة بها (`MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `MYSQLPORT`).

### ب. إضافة خدمة Redis:
1. داخل نفس المشروع، اضغط **+ New** ثم **Database** ثم اختر **Add Redis**.
2. سيقوم Railway بتوليد متغير `REDIS_URL` تلقائياً.

---

## الخطوة 3: رفع وإعداد الباك إند (Backend) على Railway

1. اضغط **+ New** ثم اختر **GitHub Repo** واختر مستودع الباك إند (`HassanY1010/nojoom-backend` أو حدد المجلد `nojoom-backend-main` إذا كنت ترفع مستودعاً واحداً).
2. في إعدادات الخدمة (**Settings**):
   - **Root Directory**: اضبطه على `/nojoom-backend-main` (إذا كان المستودع يضم الفرونت والباك معاً).
   - **Healthcheck Path**: `/api/health`
3. من قسم **Networking**:
   - اضغط **Generate Domain** لتحصل على رابط عام للباك إند (مثال: `nojoom-backend-production.up.railway.app`).
4. توجه إلى تبويب المتغيرات (**Variables**) وأضف المتغيرات التالية:

```env
NODE_ENV=production
PORT=3333

# قاعدة البيانات (يمكنك ربطها مباشرة عبر Reference من خدمة MySQL أو نسخ قيمها)
DB_HOST=${{MySQL.MYSQLHOST}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_PORT=${{MySQL.MYSQLPORT}}

# الذاكرة المؤقتة والطوابير
REDIS_URL=${{Redis.REDIS_URL}}

# الحماية والأمان (أدخل نصوص عشوائية قوية طويلة)
JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long_12345
JWT_REFRESH_SECRET=super_secret_refresh_jwt_key_at_least_32_characters_long_67890

# رابط الفرونت إند (مهم جداً للـ CORS و WebSockets)
# ضعه برابط الفرونت إند الذي ستولده في الخطوة التالية:
CLIENT_URL=https://nojoom-frontend.up.railway.app

# إعدادات التخزين السحابي Supabase Storage
STORAGE_PROVIDER=s3
S3_BUCKET=nojoom-media
S3_REGION=us-east-1
S3_ENDPOINT=https://<PROJECT-REF>.supabase.co/storage/v1/s3
S3_ACCESS_KEY_ID=<YOUR_SUPABASE_ACCESS_KEY_ID>
S3_SECRET_ACCESS_KEY=<YOUR_SUPABASE_SECRET_ACCESS_KEY>
S3_PUBLIC_BASE_URL=https://<PROJECT-REF>.supabase.co/storage/v1/object/public/nojoom-media
S3_FORCE_PATH_STYLE=true
```

---

## الخطوة 4: رفع وإعداد الفرونت إند (Frontend) على Railway

1. اضغط **+ New** ثم اختر مستودع الفرونت إند (`HassanY1010/nojoom-frontend-v2` أو المجلد `nojoom-frontend-main`).
2. في إعدادات الخدمة (**Settings**):
   - **Root Directory**: اضبطه على `/nojoom-frontend-main` (إذا كان بمستودع موحد).
   - **Port**: تأكد أنه مضبوط على `80` (لأن الفرونت يعمل عبر Nginx).
3. من قسم **Networking**:
   - اضغط **Generate Domain** لتحصل على رابط الفرونت إند العام (مثال: `nojoom-frontend.up.railway.app`).
   - انسخ هذا الرابط وضعه في متغير `CLIENT_URL` الخاص بالباك إند!
4. توجه إلى تبويب المتغيرات (**Variables**) وأضف المتغيرات الخاصة بالبناء:

```env
VITE_API_URL=https://<BACKEND-DOMAIN>.up.railway.app/api
VITE_SOCKET_URL=https://<BACKEND-DOMAIN>.up.railway.app
```

---

## الخطوة 5: التحقق والتشغيل

1. **فحص الباك إند:**
   - افتح الرابط: `https://<BACKEND-DOMAIN>.up.railway.app/api/health`
   - يجب أن تظهر رسالة نجاح `status: "healthy"`.
2. **فحص قاعدة البيانات والجداول:**
   - الباك إند مبرمج تلقائياً لإنشاء جميع الجداول والبيانات الأساسية عند بدء التشغيل لأول مرة (`initializeDatabase`).
3. **فحص الفرونت إند:**
   - افتح رابط الفرونت إند وسجل حساباً جديداً، وجرب رفع فيديو أو صورة شخصية. ستلاحظ أن الملف يُرفع فوراً ويُحفظ داخل Bucket الـ `nojoom-media` في Supabase!
