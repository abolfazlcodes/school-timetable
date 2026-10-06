# معماری فاز یک سامانه برنامه‌ریزی مدارس

## وضعیت مخزن و تصمیم‌های پایه

این مخزن در آغاز خالی بود؛ بنابراین سامانه به‌صورت greenfield ساخته می‌شود. معماری یک monolith ماژولار و strongly typed است تا فاز یک بدون پیچیدگی عملیاتی microservice اجرا شود و در عین حال مرزهای دامنه برای جداسازی آتی روشن بماند.

- رابط و API: Next.js App Router و TypeScript با strict mode
- رابط کاربری: React، CSS variables و کامپوننت‌های داخلی دسترس‌پذیر؛ RTL و فارسی در سطح سند
- اعتبارسنجی: Zod در مرز فرم/API و invariantهای مستقل در دامنه
- داده: PostgreSQL و Drizzle ORM؛ migrationهای نسخه‌شده
- احراز هویت: session تصادفی، hash شده در پایگاه‌داده و کوکی HttpOnly/SameSite=Lax/Secure در production
- مجوزها: RBAC با دو نقش `ADMIN` و `VICE_PRINCIPAL`
- زمان‌بندی: مدل قیود CP-SAT روی Node.js، با validator مستقل و امتیازدهی قابل توضیح برای گزینه‌های معتبر
- آزمون: Vitest برای دامنه/solver/API و Playwright برای جریان‌های حیاتی UI

## مرزهای ماژول

```text
UI (Persian/RTL)
  -> server actions / route handlers
    -> authorization + tenant context
      -> application services
        -> domain validation / scheduling / scoring
          -> repositories (Drizzle)
            -> PostgreSQL
```

کد رابط اجازه دسترسی مستقیم به ORM ندارد. هر عملیات مدرسه‌ای ابتدا `TenantContext` شامل `userId`، `schoolId` و `role` را از session معتبر می‌گیرد. repositoryها برای موجودیت‌های tenant-scoped، `schoolId` را آرگومان اجباری می‌گیرند و queryهای update/delete علاوه بر شناسه رکورد با `schoolId` محدود می‌شوند.

## چندمدرسه‌ای و امنیت داده

- کاربر از طریق `school_memberships` به یک یا چند مدرسه و یک نقش متصل می‌شود.
- مدرسه فعال در session نگه‌داری می‌شود، نه در ورودی قابل‌اعتماد کاربر.
- موجودیت‌های آموزشی مستقیماً `school_id` دارند؛ داده‌های سالانه علاوه بر آن `academic_year_id` دارند.
- unique indexها شامل `school_id` هستند؛ برای نمونه کد پرسنلی فقط در یک مدرسه یکتا است.
- schedule snapshotها immutable هستند؛ ویرایش پیش‌نویس revision جدید می‌سازد.
- هیچ repository عمومی با `findById(id)` برای داده tenant-scoped وجود ندارد؛ شکل مجاز `findById(schoolId, id)` است.
- در استقرار production، Row Level Security در PostgreSQL یک لایه دفاعی دوم خواهد بود؛ کنترل برنامه‌ای همچنان اجباری است.

## احراز هویت و مجوز

رمزها با الگوریتم کند و salt‌دار hash می‌شوند. token نشست فقط یک‌بار در مرورگر قرار می‌گیرد و digest آن ذخیره می‌شود. logout نشست را revoke می‌کند. جدول مجوزها:

| عمل | ADMIN | VICE_PRINCIPAL |
|---|---:|---:|
| تنظیم مدرسه و اعضا | بله | خیر |
| مدیریت داده آموزشی | بله | بله |
| تولید و ویرایش برنامه | بله | بله |
| انتشار/بایگانی | بله | بله |

تمام mutationها مجوز را در سرور بررسی می‌کنند. route protection فقط یک بهبود تجربه کاربری است و مرز امنیتی محسوب نمی‌شود.

پیاده‌سازی Stage 2 از scrypt برای رمز و token تصادفی ۲۵۶ بیتی برای session استفاده می‌کند. `proxy` فقط pre-filter سریع است؛ DAL اعتبار session و membership را نزدیک repository از PostgreSQL می‌خواند. جزئیات و مدل تهدید در `AUTHENTICATION.md` ثبت شده است.

## پیاده‌سازی ورودی‌های برنامه‌ریزی (Stage 3)

ورودی‌های موتور در چهار مرز ماژولار نگه‌داری می‌شوند: `academic-structure` برای سال/کلاس/زمان مدرسه، `curriculum` برای قاعدهٔ ساعت هر کلاس و الگوی جلسه، `teachers` برای شخص و تخصیص/موظفی/حضور سالانه او، و `planning/domain` برای invariantهای مستقل. Server Actionها تنها ورودی فرم را تبدیل می‌کنند؛ اعتبارسنجی عدد فارسی، ظرفیت کلاس، session pattern، workload و availability در service/domain انجام می‌شود. رابط مرحله «دروس و ساعات» برای هر ردیف حالت کامل، ترکیبی، خردشده و pattern دقیق را ارائه می‌کند و repository زمان‌بندی curriculum سال را روی کلاس‌های فعال همان سال گسترش می‌دهد و سپس تخصیص دبیر را اعمال می‌کند؛ ظرفیت دبیر هیچ‌گاه سازندهٔ curriculum نیست.

`/planning` یک route با stepper هفت‌مرحله‌ای است. در Stage 3 سه گام اول فعال‌اند و مراحل بعدی بدون route یا صفحه نمایشی قفل‌اند. `/teachers` همان `TeacherWorkspace` را بازاستفاده می‌کند تا مدیریت دبیر در sidebar در دسترس باشد، بدون تکثیر منطق یا ساخت صفحه‌های workload/availability.

Migrationهای `0001_planning_inputs.sql` و `0002_planning_invariants.sql` برای رابطه‌های حساس از foreign key مرکب استفاده می‌کنند و جمع/تعداد session pattern را نیز در DB می‌سنجند. migration `0009` رابطهٔ قدیمی دبیر/درس را به تخصیص سالانهٔ دارای ساعت ارتقا می‌دهد، migration `0010` تخصیص قطعی دبیر به کلاس/درس را با مرز مرکب مدرسه و سال اضافه می‌کند، migration `0011` ظرفیت واحد آموزشی هر زنگ را ثبت می‌کند و migration `0012` ثبت شخص با فقط یک بخش نام واقعی را بدون پذیرش نام کاملاً خالی ممکن می‌سازد. بنابراین حتی اگر کنترل service دور زده شود، اتصال سال، پایه، رشته، درس، دبیر، روز یا زنگ یک مدرسه به رکورد مدرسه دیگر در PostgreSQL رد می‌شود. حذف سخت در UI وجود ندارد؛ غیرفعال‌سازی، تاریخچه و قابلیت استفاده مجدد را حفظ می‌کند.

اصلاح پس از فاز یک، خط زمانی هر روز را با `school_day_schedules` و `school_breaks` صریح کرده است. پیکربندی روز شروع/پایان، تعداد زنگ و حالت خودکار/دستی را نگه می‌دارد؛ فاصله‌ها رکورد مستقل `BREAK` یا `TRANSITION` هستند و lesson/slot جعلی محسوب نمی‌شوند. محاسبهٔ خودکار پس از کسر فاصله‌های قابل‌تنظیم، دقیقه‌های تدریس باقی‌مانده را به‌شکل قطعی پخش می‌کند و دقیقاً به پایان مدرسه می‌رسد. ذخیرهٔ دستی همان validator خط زمانی و constraint trigger تعویقی migration `0008_school_day_timeline.sql` را طی می‌کند. شناسهٔ زنگ‌های هم‌موقعیت هنگام ویرایش حفظ می‌شود تا availability ثبت‌شدهٔ دبیران بی‌دلیل از بین نرود.

## معماری رابط

- layout اصلی با `lang="fa"` و `dir="rtl"` است.
- tokenهای رنگ، فاصله، radius، سایه و typography در یک stylesheet مرکزی تعریف می‌شوند.
- theme سه‌حالته `light | dark | system` است و قبل از paint روی سند اعمال می‌شود.
- ارقام برای نمایش با `Intl.NumberFormat('fa-IR')` و تاریخ‌ها با تقویم فارسی `Intl.DateTimeFormat('fa-IR-u-ca-persian')` قالب‌بندی می‌شوند؛ مقادیر ورودی/API عدد استاندارد باقی می‌مانند.
- business logic در `src/domain` و `src/modules` است و در componentها قرار نمی‌گیرد.
- معماری اطلاعات عمداً فقط پنج مقصد دارد: داشبورد، برنامه‌ریزی، دبیران، برنامه هفتگی و تنظیمات.
- جدول‌های دامنه به صفحه‌های CRUD مستقل تبدیل نمی‌شوند؛ جریان یکپارچه و workspaceهای متراکم واسط اصلی‌اند.
- روزها، ساعت شروع/پایان، زنگ‌ها و فاصله‌ها در یک ویرایشگر فشرده داخل «ساختار مدرسه» قرار دارند؛ درس/ساعات در گام دوم و درس/موظفی/حضور دبیر در یک detail panel قرار گرفته‌اند.
- جزئیات ادغام صفحه‌ها و مرز ایجاد route در `INFORMATION-ARCHITECTURE.md` ثبت شده است.

## API و خطاها

Route handlerها JSON envelope نسخه‌پذیر بازمی‌گردانند. خطاهای دامنه دارای code پایدار و پیام فارسی امن هستند. خطای خام SQL یا solver به کاربر نشان داده نمی‌شود. ورودی نامعتبر `400`، نشست نامعتبر `401`، مجوز ناکافی `403`، نبود داده tenant-scoped به‌صورت `404` و conflict دامنه `409` پاسخ می‌گیرد.

در سخت‌سازی Stage 7، پارامترهای route خروجی allowlist و UUID دقیق دارند و درخواست باید دقیقاً یک منبع از workspace، version یا run معرفی کند. rank فقط برای run و شناسه کلاس/دبیر فقط برای نمای متناظر پذیرفته می‌شود. routeهای PDF/Excel redirect امنیتی Next.js را دوباره پرتاب می‌کنند تا نبود session هرگز به خطای عمومی تبدیل نشود. school فعال فقط از session معتبر خوانده می‌شود؛ آزمون سرتاسری نیز دسترسی مدرسه دوم به شناسه نسخه مدرسه اول را رد می‌کند.

## تاریخچه و نسخه‌بندی

هویت معلم و فهرست درس مدرسه قابل استفاده مجدد است، اما curriculum، تخصیص ساعت هر درس به دبیر، workload و availability سالانه نسخهٔ خود را دارند. هر generation یک `schedule_run` با input fingerprint، seed ثابت، وضعیت، زمان اجرا و آمار می‌سازد. candidateها و entryهای هر نسخه حفظ می‌شوند. تغییر کلاس، curriculum، تخصیص یا availability در سال جدید، نسخه قبلی را mutate نمی‌کند.

در Stage 4، `schedule_runs` و `schedule_candidates` مرز persistence نتیجه حل را فراهم می‌کنند. این رکوردها tenant-scoped هستند و FK مرکب اجازه اتصال run به سال مدرسه دیگر یا candidate به run مدرسه دیگر را نمی‌دهد. تبدیل candidate به workspace قابل ویرایش در Stage 5 و versioning انتشار در Stage 6 انجام می‌شود.

در Stage 5، candidate بدون mutation باقی می‌ماند و `schedule_workspaces` snapshot کاری آن را نگه می‌دارد. foreign keyهای مرکب اتصال workspace به سال، run و candidate مدرسه دیگر را در DB رد می‌کنند. هر mutation فقط شناسه و intent تغییر را از client می‌گیرد، داده قابل اعتماد را دوباره از tenant context می‌خواند، validator مستقل را اجرا می‌کند و با شرط `revision` ذخیره می‌شود. این optimistic concurrency مانع overwrite خاموش تغییر هم‌زمان دو مدیر است.

در Stage 6، `schedule_versions` snapshot کامل assignmentها و validation را با شماره ترتیبی و وضعیت DRAFT/PUBLISHED/ARCHIVED ذخیره می‌کند. شماره‌گذاری در transaction و با lock سال تحصیلی انجام می‌شود؛ partial unique index نیز فقط یک PUBLISHED برای مدرسه/سال را مجاز می‌داند. پیش از publish، validator مستقل دوباره اجرا می‌شود: خطای سخت انتشار را متوقف و هشدار نرم تأیید صریح می‌خواهد. مشاهده نسخه تاریخی read-only است و fork، workspace تازه‌ای با مرجع نسخه مبدا می‌سازد. route handlerهای PDF/Excel نیز tenant context را از session می‌گیرند و هیچ school id قابل‌اعتمادی از query نمی‌پذیرند.

Migrationهای `0006_hardening_invariants.sql` و `0007_period_overlap_upsert.sql` لایه دفاعی دیتابیس را کامل می‌کنند: actor هر run/workspace/version باید عضو همان مدرسه باشد؛ زنجیره منبع workspace/version با FK مرکب در همان مدرسه، سال، run و candidate می‌ماند؛ JSONهای ساختاریافته نوع صحیح دارند؛ نسخه منتشرشده نمی‌تواند issue با شدت ERROR یا امتیاز خارج از بازه داشته باشد؛ periodهای فعال هم‌پوشان و کلاس ناسازگار با plan در trigger رد می‌شوند. migration دوم رفتار overlap trigger را برای seed/upsert با کلید طبیعی period idempotent نگه می‌دارد.

## تصمیم‌های عملیاتی

- Docker Compose یک PostgreSQL محلی فراهم می‌کند.
- schema migration تنها مسیر تغییر schema است.
- seed داده فارسی نمایشی می‌سازد.
- secrets وارد repository نمی‌شوند و `.env.example` فقط نام متغیرها را مستند می‌کند.
- مجموعه کنترل کیفیت شامل unit/integration، Playwright، lint، typecheck، build تولیدی و benchmark قطعی solver است.
