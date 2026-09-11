# مدرسه‌یار

پنل فارسی و RTL برای مدیریت و تولید قطعی برنامه هفتگی مدارس.

## اجرای محلی

پیش‌نیازها: Node.js 22، npm و Docker.

```bash
cp .env.example .env.local
docker compose up -d
npm install
npm run db:setup
npm run dev
```

سپس `http://localhost:3000` را باز کنید.

حساب‌های نمایشی پس از seed:

- مدیر: `admin@madreseyar.ir` / `Demo123!`
- معاون: `moaven@madreseyar.ir` / `Demo123!`

## جریان نمونه برنامه

از «برنامه‌ریزی» ساختار، دروس، دبیران و حضور را بررسی کنید؛ در گام «بررسی اطلاعات» خطاهای مسدودکننده را رفع و در گام بعد برنامه را تولید کنید. یکی از گزینه‌ها را برای اصلاح به workspace ببرید، تغییرها را اعتبارسنجی کنید و در گام «انتشار» نسخه جاری را منتشر کنید. تاریخچه، fork نسخه قبلی و خروجی PDF/Excel/چاپ همگی در «برنامه هفتگی» قرار دارند.

## کنترل کیفیت

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run benchmark:scheduling
npm run build
```

`npm run db:setup` تکرارپذیر است و می‌توان آن را برای اعمال migrationهای جدید و به‌روزرسانی idempotent داده نمایشی دوباره اجرا کرد. جزئیات معماری در پوشه `docs` و وضعیت پیاده‌سازی در `docs/PHASE-1-CHECKLIST.md` قرار دارد.
