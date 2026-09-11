# چک‌لیست فاز یک

## نمای کلی و روش اجرا

فاز یک یک پنل کوچک اما کامل برای ساخت، تولید، اصلاح و انتشار برنامه هفتگی است. backend و مدل دامنه محدودیت‌های لازم را کامل نگه می‌دارند؛ UI فقط پنج مقصد دارد و entityها را به صفحه‌های CRUD پراکنده تبدیل نمی‌کند.

هر Stage جداگانه پیاده‌سازی، آزمون و مستند می‌شود. شروع Stage بعد فقط با تأیید صریح کاربر مجاز است. checkbox تنها پس از بررسی موفق علامت می‌خورد.

## تصمیم‌های معماری

- [x] monolith ماژولار Next.js + TypeScript strict
- [x] PostgreSQL + Drizzle با scope اجباری مدرسه
- [x] session امن سمت سرور و نقش‌های ADMIN/VICE_PRINCIPAL
- [x] موتور deterministic CSP و validator مستقل
- [x] design tokenهای CSS، رابط فارسی RTL و theme سه‌حالته
- [x] معماری اطلاعات پنج‌بخشی و جریان برنامه‌ریزی هفت‌مرحله‌ای

## Stage 0 — کشف و معماری

- [x] بررسی مخزن و تشخیص greenfield بودن
- [x] انتخاب frontend، backend، پایگاه‌داده، auth و authorization
- [x] تعریف tenancy چندمدرسه‌ای و مدل دامنه
- [x] جداسازی lesson requirement از schedule placement
- [x] تعریف معماری solver، hard/soft constraints و validation
- [x] مستندسازی معماری، داده، scheduling و معماری اطلاعات
- [x] ایجاد چک‌لیست مرحله‌ای

معیار پذیرش: جداسازی مدرسه، روابط اصلی، موتور قطعی و UX پنج‌بخشی در docs روشن‌اند. **قبول شد.**

## Stage 1 — بنیان رابط و معماری اطلاعات

- [x] پوسته فارسی RTL و typography فارسی
- [x] light، dark و system theme
- [x] design tokenهای سراسری
- [x] sidebar، header و breadcrumb واکنش‌گرا
- [x] toast، dialog، form، table و stateهای عمومی
- [x] مبانی accessibility و print styles
- [x] کاهش sidebar به دقیقاً پنج مقصد
- [x] حذف اعلان و navigationهای entityمحور
- [x] کوچک‌سازی داشبورد به آمار، وضعیت و مسائل ضروری
- [x] جلوگیری از route/link نمایشی منتهی به 404
- [x] آزمون IA، lint، typecheck، build و بررسی بصری desktop/mobile

معیار پذیرش: داشبورد متراکم و منوی «داشبورد، برنامه‌ریزی، دبیران، برنامه هفتگی، تنظیمات» در هر دو theme خوانا است؛ هیچ صفحه placeholder وجود ندارد. **قبول شد: ۱۳ آزمون، lint، typecheck و build سبز؛ themeها به‌صورت تعاملی و desktop/mobile به‌صورت بصری بررسی شدند.**

## Stage 2 — ورود، مدرسه و امنیت tenant

- [x] schema کاربر، مدرسه، عضویت و session
- [x] login/logout و session قابل ابطال
- [x] route protection سمت سرور
- [x] نقش ADMIN و VICE_PRINCIPAL
- [x] tenant context اجباری در repository/service
- [x] انتخاب مدرسه و تنظیمات حداقلی پروفایل
- [x] آزمون auth، RBAC و نشت بین دو مدرسه

معیار پذیرش: کاربر فقط داده مدرسه عضو خود را می‌بیند و mutation غیرمجاز سمت سرور رد می‌شود. **قبول شد: ۲۸ آزمون unit/integration، سه آزمون Playwright، lint، typecheck، build و setup تکرارپذیر پایگاه‌داده موفق.**

## Stage 3 — جریان برنامه‌ریزی: ورود داده

### Step 1 — ساختار مدرسه

- [x] سال تحصیلی با تاریخچه و سال فعال
- [x] پایه، رشته و کلاس در یک نمای فشرده
- [x] تعداد دانش‌آموز، ظرفیت، پیشنهاد `ceil` و override
- [x] نام و وضعیت کلاس

### Step 2 — دروس و ساعات

- [x] درس و curriculum وابسته به پایه/رشته/سال در یک نما
- [x] ساعت، تعداد جلسه، duration و pattern منعطف
- [x] نمایش خودکار workload کل هر درس
- [x] اعتبارسنجی مجموع pattern و session splitting

### Step 3 — دبیران و حضور

- [x] workspace یکپارچه فهرست/جزئیات دبیر
- [x] مشخصات، چنددرس، نوع همکاری و staff kind
- [x] min/required/max workload و overtime سالانه
- [x] grid دیداری available/unavailable/preferred/restricted
- [x] محدودیت روزانه و consecutive قابل تنظیم
- [x] استفاده یکسان از کارکنان دارای تدریس

- [x] روزهای کاری، period، start/end، break و schedule متفاوت روزانه در context مناسب
- [x] اعتبارسنجی UI/API/domain/DB و CRUD tenant-aware
- [x] آزمون class calculation، curriculum، workload، availability و isolation

معیار پذیرش: سه step نخست در یک route هدایت‌شده تکمیل می‌شوند و داده یک‌بار ثبت و در generationهای بعدی reuse می‌شود. **قبول شد: migration/seed تکرارپذیر، ۴۵ آزمون unit/integration، هفت جریان Playwright، lint، typecheck و build موفق؛ رابط desktop/mobile و جداسازی دو مدرسه بررسی شد.**

## Stage 4 — پیش‌بررسی و موتور زمان‌بندی

### Step 4 — بررسی اطلاعات

- [x] preflight مستقل برای curriculum/teacher/availability/period/assignment
- [x] capacity، workload، pattern و consistency checks
- [x] ERROR/WARNING/INFO فارسی با اقدام مستقیم اصلاح

### Step 5 — تولید برنامه

- [x] مدل ورودی/خروجی engine مستقل از UI/DB
- [x] CSP با domain construction، propagation، MRV و forward checking
- [x] hard constraints کلاس/دبیر/حضور/session/workload/period
- [x] soft scoring، penalty breakdown و branch-and-bound
- [x] نتیجه deterministic با fingerprint و budget
- [x] چند candidate یکتا هنگام امکان
- [x] no-solution قابل‌فهم و بدون برنامه نامعتبر
- [x] نمایش progress و خلاصه valid/invalid/warning/score غیرتخصصی
- [x] آزمون conflict، availability، required hours، workload، session count، scoring و no-solution

معیار پذیرش: خروجی موفق هیچ hard violation ندارد، قابل بازتولید است و نبود جواب را توضیح می‌دهد. **قبول شد: سه candidate معتبر روی seed واقعی، validator مستقل، ۵۳ آزمون unit/integration و هفت جریان Playwright؛ lint، typecheck، build و migration تکرارپذیر موفق.**

## Stage 5 — workspace برنامه هفتگی و اصلاح

### Step 6 — بررسی و اصلاح

- [x] یک workspace با tabs کلاس‌ها/دبیران و فیلتر پایه/رشته/کلاس
- [x] grid حرفه‌ای روز × زنگ در RTL و هر دو theme
- [x] edit drawer برای move/day/period/teacher/add/delete/swap
- [x] validator مستقل پس از هر تغییر
- [x] conflict و warning زمینه‌ای با پیام فارسی
- [x] جلوگیری از silent invalid state؛ تأیید صریح warning
- [x] نمای چاپی تمیز

معیار پذیرش: مشاهده و اصلاح و validation بدون خروج از workspace انجام می‌شود. **قبول شد: candidate تولیدشده به نسخهٔ کاری مستقل تبدیل می‌شود؛ جابه‌جایی، تغییر دبیر/روز/زنگ، تعویض، برداشتن و جایگذاری دوباره با اعتبارسنجی اتمیک کار می‌کنند؛ ۶۳ آزمون unit/integration و هشت جریان Playwright، lint، typecheck، build و migration واقعی موفق‌اند.**

## Stage 6 — نسخه، انتشار و خروجی

### Step 7 — انتشار

- [x] schedule run و candidate metadata
- [x] وضعیت DRAFT/PUBLISHED/ARCHIVED
- [x] snapshot و مشاهده نسخه‌های قبلی در workspace
- [x] fork نسخه منتشرشده پیش از ویرایش
- [x] تأیید و انتشار نسخه جاری
- [x] PDF فارسی RTL، Excel و چاپ برای کلاس/دبیر/مدرسه
- [x] dashboard متصل به داده واقعی و اقدام ادامه برنامه‌ریزی
- [x] آزمون تاریخچه، انتشار و خوانایی export

معیار پذیرش: تغییر داده و generation جدید نسخه قبلی را خراب نمی‌کند و خروجی‌های فارسی خوانا هستند. **قبول شد: snapshotهای immutable و tenant-scoped، انتشار اتمیک با یک نسخه جاری، fork مستقل، تاریخچه در workspace، خروجی PDF/Excel/print برای سه نما و داشبورد واقعی؛ ۶۸ آزمون unit/integration، ۹ جریان Playwright، lint، typecheck، build و migration واقعی موفق‌اند. PDF رندرشده نیز با فونت embedشده به‌صورت بصری بررسی شد.**

## Stage 7 — سخت‌سازی و آزمون جریان کامل

- [x] validation چندلایه UI/API/domain/DB/engine
- [x] جلوگیری عدد/زمان/reference/duplicate نامعتبر
- [x] uniqueهای tenant-aware و mutation مجاز
- [x] unit/integration tests همه invariantهای حیاتی
- [x] API tests احراز هویت، مجوز، isolation و CRUD
- [x] E2E از login تا export و generation مجدد
- [x] seed نمایشی و راهنمای اجرا/آزمون
- [x] benchmark اندازه معمول مدرسه و ثبت محدودیت solver

معیار پذیرش: جریان تعریف‌شده Done بدون ویرایش دستی DB طی می‌شود و تست‌های حیاتی سبزند. **قبول شد: ۷۳ آزمون unit/integration، ۱۱ جریان Playwright، lint، typecheck، build تولیدی، migration/seed تکرارپذیر و benchmark مستقل solver همگی موفق‌اند. benchmark مرجع ۱۲ کلاس، ۴۸ جلسه و ۸ دبیر را در budget سه‌ثانیه‌ای با نتیجه معتبر و اعتبارسنجی مستقل حل کرد.**

## معیارهای ساده‌سازی UI

- [x] Sidebar بدون بخش غیرضروری و فقط پنج مقصد است
- [x] setup یک workflow هفت‌مرحله‌ای است
- [x] دبیر، درس‌ها، workload و availability یک workspace دارند
- [x] validation و conflict زمینه‌ای‌اند و منوی مستقل ندارند
- [x] timetable، اصلاح، نسخه و export یک workspace دارند
- [x] تنظیمات حداقلی است
- [x] route یا صفحه placeholder وجود ندارد
- [x] CRUD تکراری و entityمحور وجود ندارد
- [x] جریان اصلی با کمترین جابه‌جایی قابل فهم است
- [x] UI کاملاً فارسی و RTL است
- [x] light/dark/system حفظ شده است
- [x] معماری core scheduling بدون کاهش constraintها حفظ شده است

## محدودیت‌های شناخته‌شده فعلی

- فایل Excel در فاز یک SpreadsheetML سازگار با Excel و پسوند `.xls` است؛ خروجی بومی `.xlsx` در صورت نیاز آینده قابل افزودن است.
- نسخه‌ها snapshot کامل برنامه‌اند و تغییر مستقیم ندارند؛ برای اصلاح نسخه تاریخی باید از آن workspace مستقل ساخته شود.
- room/resource در scope فعال فاز یک نیست؛ adapter توسعه آینده در مدل engine حفظ خواهد شد.
- benchmark مرجع با ۱۲ کلاس و ۴۸ جلسه در budget سه‌ثانیه‌ای اجرا می‌شود؛ مدارس بسیار بزرگ‌تر ممکن است به budget بالاتر یا adapter حل‌گر اختصاصی مانند OR-Tools نیاز داشته باشند. در هر حالت، اتمام budget هیچ قید سختی را تضعیف نمی‌کند.

## انجام‌شده

- Stage 0: کشف، معماری فنی/دامنه و معماری اطلاعات ساده‌شده.
- Stage 1: design system، RTL، theme، پوسته پنج‌بخشی، primitiveهای UI و داشبورد فشرده.
- Stage 2: ورود/خروج، session قابل ابطال، PostgreSQL، نقش‌ها، tenant context، انتخاب مدرسه و تنظیمات حداقلی.
- Stage 3: جریان سه‌گامی ورود داده، ساختار/کلاس، curriculum، زمان مدرسه و workspace یکپارچه دبیر/حضور.
- Stage 4: پیش‌بررسی فارسی، solver قطعی CSP، validator مستقل، چند candidate و نتیجه قابل‌فهم.
- Stage 5: workspace واحد کلاس/دبیر، grid برنامه، اصلاح دستی امن، validation زمینه‌ای و چاپ.
- Stage 6: نسخه‌های immutable، انتشار و بایگانی، fork، تاریخچه، PDF/Excel/print و داشبورد واقعی.
- Stage 7: سخت‌سازی invariantهای DB و مرز خروجی، آزمون امنیت tenant و نشست، جریان کامل تولید مجدد، benchmark solver و راهنمای اجرای نهایی.

## باقی‌مانده

- مورد مسدودکننده‌ای برای تعریف انجام‌شده Phase 1 باقی نمانده است؛ محدودیت‌های بالا برای توسعه‌های احتمالی آینده ثبت شده‌اند.
