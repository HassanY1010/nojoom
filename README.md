# نجوم | Nojoom 🌟

منصة وسائط اجتماعية متكاملة لمشاركة الفيديوهات القصيرة، البث المباشر، والتفاعل المجتمعي، مبنية بنموذج هجين يجمع بين تجربة مستخدم عصرية (شبيهة بـ TikTok و Instagram Reels) وبنية برمجية متعددة المستأجرين (Multi-Tenant B2B SaaS).

---

## 🚀 المميزات الرئيسية (Core Features)

- **خلاصة الفيديوهات (Short Video Feed):** سكرول لا نهائي للفيديوهات القصيرة، مشغل HLS سريع، وتفاعل كامل (إعجابات، تعليقات، مشاركات، حفظ).
- **القصص والتحديات (Stories & Challenges):** نشر قصص مؤقتة ومسابقات تفاعلية مع شارات للمشاركين والفائزين.
- **البث المباشر (Live Streaming):** بث مباشر لحظي مع شات تفاعلي ونظام هدايا ونقاط.
- **الشات والمراسلات (Realtime Messaging):** محادثات فردية وجماعية مدعومة بـ Socket.IO، مع دعم الرسائل الصوتية والرسائل المتحركة.
- **محفظة النقاط (Wallet & Monetization):** نظام مكافآت يومية، تحصيل أرباح، وإرسال واستقبال الهدايا الافتراضية.
- **تعدد المستأجرين (Multi-Tenant SaaS):** دعم إنشاء مساحات مخصصة ونطاقات فرعية (Subdomains) للمؤسسات والشركات مع تخصيص الهوية البصرية (White-Labeling).
- **لوحات تحكم متقدمة (Admin Dashboards):** لوحة Super Admin لإدارة النظام ولوحات Tenant Admin لإدارة كل منظمة ومحتواها وبلاغاتها.
- **التخزين السحابي (Cloud Storage):** توافق كامل مع Supabase Storage / AWS S3 لحفظ وسائط الفيديوهات والصور عبر شبكات التوصيل السريع (CDN).

---

## 🛠️ البنية التقنية (Tech Stack)

### Backend:
- **Node.js (Express 5)**
- **MySQL 8** مع Sequelize ORM
- **Redis & BullMQ** (إدارة الطوابير ومعالجة الوسائط الخلفية)
- **Socket.IO** (التفاعل اللحظي والشات)
- **FFmpeg** (معالجة وتقطيع الفيديو وضغطه)
- **AWS S3 / Supabase Storage Client** (تخزين الوسائط السحابي)

### Frontend:
- **React 19 & TypeScript**
- **Vite** (بناء سريع وأداء عالي)
- **Tailwind CSS & Framer Motion** (واجهة مستخدم عصرية وسلسة)
- **Zustand** (إدارة الحالة)
- **i18next** (دعم كامل للعربية RTL والإنجليزية LTR)
- **PWA Ready** (تطبيق ويب تقدمي)

---

## 📂 هيكل المشروع (Project Structure)

```
Nojoom/
├── nojoom-backend-main/     # سيرفر الباك إند (Node.js/Express)
├── nojoom-frontend-main/    # تطبيق الواجهة الأمامية (React/Vite)
├── deploy/                  # ملفات النشر السحابي (Kubernetes)
├── docs/                    # التوثيق الفني والأمني
├── docker-compose.yml       # تشغيل المنصة محلياً عبر Docker
├── RAILWAY_SUPABASE_GUIDE.md # دليل النشر على Railway و Supabase
└── README.md
```

---

## ⚡ التشغيل السريع (Quick Start)

### 1. تشغيل الباك إند:
```bash
cd nojoom-backend-main
npm install
cp .env.example .env
npm run dev
```

### 2. تشغيل الفرونت إند:
```bash
cd nojoom-frontend-main
npm install
cp .env.example .env
npm run dev
```

### 3. التشغيل عبر Docker Compose:
```bash
docker-compose up -d
```

---

## 🌐 النشر على السحابة (Deployment)

للاطلاع على دليل النشر الكامل والمفصل خطوة بخطوة على **Railway** وربط التخزين بـ **Supabase Storage**، راجع:
👉 [دليل النشر على Railway و Supabase](RAILWAY_SUPABASE_GUIDE.md)

---

## 📄 الترخيص (License)
MIT License.
