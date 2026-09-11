# احراز هویت، مجوز و جداسازی مدرسه

## جریان ورود

1. فرم ورود با Zod در Server Action اعتبارسنجی می‌شود.
2. ایمیل normalize و رمز با scrypt بررسی می‌شود؛ پیام حساب ناشناخته و رمز نادرست یکسان است.
3. token تصادفی ۲۵۶ بیتی ساخته می‌شود. مقدار خام فقط در cookie با `HttpOnly`، `SameSite=Lax` و `Secure` در production قرار می‌گیرد.
4. تنها SHA-256 token همراه با زمان انقضا و مدرسه فعال در جدول `sessions` ذخیره می‌شود.
5. logout رکورد session را revoke و cookie را حذف می‌کند.

## دو لایه محافظت

- `src/proxy.ts` فقط وجود و طول معقول cookie را برای redirect سریع بررسی می‌کند و هیچ query پایگاه‌داده ندارد.
- DAL در هر خواندن حساس digest token، انقضا، revoke، فعال‌بودن کاربر/مدرسه و membership را در پایگاه‌داده بررسی می‌کند.

Proxy مرز امنیتی نهایی نیست. Server Actionها ورودی، session و نقش را مستقل بررسی می‌کنند.

## tenancy

`TenantContext` فقط از session معتبر ساخته می‌شود و شامل `userId`، `schoolId` و role است. شناسه مدرسه از form برای queryهای داده پذیرفته نمی‌شود. repository مدرسه profile را فقط با `context.schoolId` می‌خواند یا تغییر می‌دهد.

قید مرکب زیر در PostgreSQL یک لایه دفاعی دوم است:

```text
sessions(user_id, active_school_id)
  -> school_memberships(user_id, school_id)
```

در نتیجه حتی write مستقیم نمی‌تواند مدرسه‌ای خارج از عضویت کاربر را به session نسبت دهد.

## نقش‌ها

- `ADMIN`: مشاهده و تغییر مشخصات مدرسه
- `VICE_PRINCIPAL`: مشاهده مشخصات و مدیریت داده‌های برنامه‌ریزی در Stageهای بعد؛ تغییر مشخصات مدرسه مجاز نیست

تغییر مدرسه فعال تنها به membership فعال همان کاربر محدود است.

## آزمون‌ها

- آزمون واحد password، login، token hashing، revoke و policy نقش
- آزمون integration روی PostgreSQL سازگار PGlite برای foreign key، session و عدم تغییر مدرسه دوم
- آزمون Playwright روی PostgreSQL واقعی برای anonymous redirect، login، cookie، تغییر مدرسه، ویرایش، logout و RBAC

