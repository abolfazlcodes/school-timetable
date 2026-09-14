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

## Post-Phase-1 Correction — Period Scheduling & Visual Polish

- [x] Flexible school day model
- [x] Automatic period calculation
- [x] Manual period configuration
- [x] Variable period duration
- [x] Variable breaks
- [x] No-break transitions
- [x] Accurate school start/end handling
- [x] Teacher availability integration
- [x] Period validation
- [x] Font size review
- [x] Typography review
- [x] Full light-theme visual review
- [x] Full dark-theme visual review
- [x] RTL review
- [x] Responsive review
- [x] Timetable visual review
- [x] Component consistency review
- [x] Regression tests
- [x] Build/typecheck/lint
- [x] Final visual verification

معیار پذیرش اصلاح: خط زمانی روز با زنگ و فاصلهٔ مستقل در حالت خودکار/دستی، مدت‌های نامساوی و پایان دقیق پشتیبانی می‌شود؛ availability و solver همچنان با هویت روز+زنگ کار می‌کنند و ساعت دقیق در رابط نمایش داده می‌شود. **قبول شد: ۸۲ آزمون unit/integration و ۱۳ جریان Playwright موفق؛ migration/seed برای بار دوم موفق؛ lint، typecheck، build تولیدی و benchmark مستقل solver سبز؛ ۱۵ نمای واقعی شامل login، dashboard، همهٔ بخش‌های workflow، timetable/edit، light/dark و desktop/tablet/mobile ثبت و بازبینی شد.**

## Post-Phase-1 Real-School Data Calibration

- [x] بازبینی مستقیم هر پنج تصویر `docs-assets`
- [x] گزارش تفکیک قواعد عمومی از snapshot مدرسه/سال
- [x] curriculum سال/پایه/رشته با ساعت هر کلاس
- [x] تولید نیاز واقعی از کلاس‌های فعال همان سال
- [x] جداسازی Curriculum، Lesson Requirement، Teacher Assignment و Timetable Placement
- [x] تخصیص چندبه‌چند دبیر/درس همراه ساعت سالانه
- [x] حفظ تاریخچه متفاوت تخصیص و موظفی میان سال‌ها
- [x] محاسبه کمبود/مازاد هر درس بدون دوباره‌شماری دبیر چنددرسی
- [x] جداسازی workload از availability سخت و ترجیح نرم
- [x] اعمال سقف تخصیص سالانه هر درس در solver و validator
- [x] جداسازی ساعت آموزشی session از هویت زنگ مدرسه
- [x] نمایش محاسبه کلاس × ساعت و پوشش دبیران در UI موجود
- [x] fixture مرجع یازده دبیر و سناریوی solver مستقل از قواعد تولیدی
- [x] آزمون تغییر ۲، ۱، ۰ و ۴ کلاس و تغییر خودکار نیاز/ظرفیت
- [x] آزمون تاریخچه سالانه و جلوگیری DB از اتصال بین دو مدرسه
- [x] migration و seed تکرارپذیر روی PostgreSQL واقعی
- [x] آزمون‌های database، scheduling و جریان‌های API/auth
- [x] آزمون E2E جریان‌های curriculum، دبیر، preflight، generation و نسخه
- [x] بازبینی رندر واقعی light/dark، RTL، desktop/tablet/mobile
- [x] lint، typecheck، benchmark و production build

معیار پذیرش کالیبراسیون: تعداد کلاس فعال همان سال منبع حجم تدریس است، تخصیص هر دبیر/درس و حضور سالانه مستقل و تاریخی‌اند، کمبود/مازاد پیش از حل توضیح داده می‌شود و solver از زنگ‌های واقعی بدون مخلوط‌کردن آن‌ها با ساعت آموزشی استفاده می‌کند. **قبول شد: ۸۵ آزمون unit/integration و ۱۳ جریان Playwright موفق؛ migration `0009` و seed دو بار متوالی موفق؛ lint، typecheck، build و benchmark سبز؛ fixture مرجع ۱۱ دبیر/۱۸۹ ساعت و projection حل‌گر معتبر است؛ ۱۵ نمای رندرشده بازبینی شد.**

## Post-Phase-1 Demo Data — Shahid Beheshti

- [x] افزودن «دبیرستان شهید بهشتی» به‌عنوان tenant مستقل و قابل انتخاب
- [x] دسترسی حساب مدیر نمایشی به هر سه مدرسه
- [x] سال ۱۴۰۵–۱۴۰۶، سه پایه، سه رشته و ده کلاس فعال در شهید بهشتی
- [x] curriculum عملیاتی ۱۹ درس و ۱۸۹ ساعت مبتنی بر کلاس‌های فعال
- [x] ثبت یازده دبیر مرجع، تخصیص چنددرسی و موظفی سالانه در هر سه مدرسه
- [x] ثبت روزها و زنگ‌های قابل برنامه‌ریزی و ترجیحات حضور مرجع
- [x] توازن دقیق نیاز و ظرفیت درس‌ها در شهید بهشتی و دانا
- [x] حفظ داده قبلی فرزانگان همراه افزودن مجموعه دبیران مرجع
- [x] seed تکرارپذیر بدون ایجاد رکورد فعال تکراری
- [x] پیش‌بررسی موفق شهید بهشتی و دانا در رابط واقعی
- [x] تولید برنامه معتبر برای شهید بهشتی در آزمون سرتاسری
- [x] آزمون fixture، lint، typecheck، benchmark و production build

معیار پذیرش داده نمایشی: حساب مدیر می‌تواند هر سه مدرسه را انتخاب کند؛ شهید بهشتی و دانا هرکدام ۱۱ دبیر فعال، ۱۰ کلاس و ۱۸۹ ساعت نیاز/تخصیص متوازن دارند و از preflight تا تولید برنامه معتبر پیش می‌روند. **قبول شد: seed تکرارپذیر، ۸۷ آزمون unit/integration، ۱۴ جریان Playwright، lint، typecheck، build تولیدی و benchmark همگی موفق‌اند. دادهٔ ۱۸۹ ساعته یک projection عملیاتی و مستند از بخش قطعی منبع است و جای بازسازی حدسی ماتریس ناقص ۳۵۰ ساعته را نمی‌گیرد.**

## Post-Phase-1 Fix — Teacher Workspace State

- [x] تازه‌شدن فرم مشخصات هنگام انتخاب دبیر دیگر
- [x] reset شدن state و پیام فرم‌ها بر اساس شناسه دبیر
- [x] فقط‌خواندنی بودن اولیه مشخصات دبیر
- [x] فعال‌شدن مشخصات فقط با اقدام «ویرایش اطلاعات دبیر»
- [x] امکان لغو ویرایش و بازگشت به داده ذخیره‌شده
- [x] قفل‌شدن دوباره فرم مشخصات پس از ذخیره موفق
- [x] refresh خودکار پس از ذخیره تخصیص درس‌ها
- [x] refresh خودکار خلاصه موظفی پس از ذخیره
- [x] refresh خودکار جدول حضور و ترجیحات پس از ذخیره
- [x] state کنترل‌شده جدول حضور مستقل از refresh دستی
- [x] بازگرداندن وضعیت‌های نهایی و اعتبارسنجی‌شده در پاسخ ذخیره سرور
- [x] نمایش فوری وضعیت «تغییر ذخیره‌نشده» و «همگام با اطلاعات ذخیره‌شده»
- [x] بازتاب بصری فوری وضعیت مجاز، ترجیحی، محدود و غایب
- [x] تأیید ذخیره در همان صفحه و خواندن مجدد مقدار پس از جابه‌جایی دبیر
- [x] آزمون سرتاسری لینک مستقیم، انتخاب دبیر، edit lock، موظفی و حضور
- [x] unit/integration، lint، typecheck و production build

معیار پذیرش اصلاح workspace دبیران: جابه‌جایی بین دبیران بدون reload دستی اطلاعات درست را نشان می‌دهد، مشخصات در حالت امن فقط‌خواندنی آغاز می‌شوند و ذخیره موظفی/حضور بلافاصله با داده سرور همگام می‌شود. **قبول شد: وضعیت جدول حضور پیش و پس از ذخیره در همان صفحه و ماندگاری آن پس از جابه‌جایی دبیر تأیید شد؛ هر ۱۵ جریان Playwright و ۸۹ آزمون unit/integration موفق؛ lint، typecheck و build تولیدی نیز سبزند.**

## Post-Phase-1 Refinement — Major-wide Timetable

- [x] بازبینی مستقیم تصویر `final-whole-classes-of-school-template.jpg`
- [x] جایگزینی فهرست تخت «کل مدرسه» با ماتریس یکپارچه رشته
- [x] انتخاب یک رشته و نمایش همه پایه‌ها و کلاس‌های فعال آن
- [x] سرستون گروهی کلاس و سرستون تو در توی زنگ‌ها
- [x] سطرهای روز بر اساس روزهای کاری پیکربندی‌شده مدرسه
- [x] نمایش ساعت واقعی هر زنگ از ساختار همان سال تحصیلی
- [x] نمایش درس و دبیر در هر خانه و وضعیت خالی/هشدار/خطا
- [x] پشتیبانی از تعداد متغیر کلاس، پایه، روز و زنگ بدون مقدار ثابت
- [x] مرتب‌سازی کلاس‌ها بر اساس اولویت پایه و سپس نام کلاس
- [x] بازبینی رندر واقعی در تم روشن و تیره
- [x] نمایش فشرده دسکتاپ و اسکرول محصور جدول در موبایل
- [x] چیدمان مناسب چاپ نمای رشته
- [x] آزمون فیلتر رشته، گروه‌بندی کلاس‌ها و زنگ‌ها
- [x] آزمون E2E با سه کلاس ریاضی شهید بهشتی از دهم تا دوازدهم
- [x] unit/integration، E2E، lint، typecheck و production build

معیار پذیرش نمای یکپارچه رشته: در همان workspace برنامه هفتگی، مدیر یک رشته را انتخاب می‌کند و کلاس‌های پایه‌های آن را به‌صورت گروهی، زنگ‌ها را زیر هر کلاس و روزهای کاری را در سطرها می‌بیند؛ محتوا از دادهٔ سال جاری ساخته می‌شود و تصویر مرجع فقط الگوی نمایش است. **قبول شد: ۸۹ آزمون unit/integration و هر ۱۵ جریان Playwright موفق؛ رندر واقعی شهید بهشتی با سه کلاس ریاضی و ۱۲ سرستون زنگ در light/dark و رفتار mobile بررسی شد؛ lint، typecheck و build تولیدی سبزند.**

## Post-Phase-1 Delivery Preparation — Shahid Beheshti

- [x] پروفایل seed مستقل برای نسخه تحویلی
- [x] ایجاد فقط دبیرستان شهید بهشتی در دیتابیس تازه
- [x] ایجاد فقط یک حساب مدیر و یک حساب معاون
- [x] عضویت هر دو حساب فقط در شهید بهشتی
- [x] ثبت حمید باقری با نقش معاون و دبیر فارسی
- [x] خالی‌گذاشتن آگاهانه موظفی و حضور نامعلوم حمید باقری
- [x] الزام ایمیل و رمز امن از متغیر محیطی
- [x] جلوگیری از seed تحویلی روی دیتابیس دارای tenant یا کاربر اضافه
- [x] عدم چاپ یا commit رمزهای نسخه تحویلی
- [x] تنظیم pool اتصال مناسب اجرای serverless
- [x] راهنمای فارسی آماده ارسال به معاون
- [x] توضیح دقیق وضعیت‌های مجاز، ترجیحی، محدود و غایب
- [x] راهنمای استقرار Vercel و PostgreSQL مدیریت‌شده
- [x] آزمون واحد پیکربندی حساب‌های تحویلی
- [x] آزمون واقعی migration و seed روی PostgreSQL موقت
- [x] بررسی شمار یک مدرسه، دو کاربر، دو عضویت و دوازده دبیر
- [x] typecheck، lint، unit/integration و production build
- [ ] ساخت پروژه/دیتابیس ابری و استقرار نهایی با حساب مالک

معیار پذیرش آماده‌سازی تحویل: یک PostgreSQL تازه با فرمان `npm run db:setup:delivery` فقط tenant شهید بهشتی و دو حساب مجاز را می‌سازد، داده‌های فعلی مدرسه را نگه می‌دارد و اطلاعات تأییدنشده معاون را حدس نمی‌زند. **قبول شد: اجرای واقعی migration/seed نتیجهٔ دقیق ۱ مدرسه، ۲ کاربر، ۲ عضویت، ۱۲ دبیر، ۱۰ کلاس و ۱ سال تحصیلی داد؛ حمید باقری با درس فارسی و صفر ساعت اولیه، بدون profile موظفی و بدون availability ایجاد شد؛ ۹۲ آزمون، lint، typecheck و build تولیدی موفق‌اند. استقرار ابری به‌دلیل نیاز به حساب Vercel، دیتابیس و رمزهای واقعی مالک هنوز اقدام خارجیِ باقی‌مانده است.**

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
- تصاویر مرجع همهٔ ۳۵۰ ساعت را با جزئیات قطعی و ماشین‌خوان پوشش نمی‌دهند؛ fixture دقیق فقط بخش ساختاریافتهٔ ۱۱ دبیر/۱۸۹ ساعت را نگه می‌دارد و باقی داده‌ها عمداً حدس زده نشده‌اند.

## انجام‌شده

- Stage 0: کشف، معماری فنی/دامنه و معماری اطلاعات ساده‌شده.
- Stage 1: design system، RTL، theme، پوسته پنج‌بخشی، primitiveهای UI و داشبورد فشرده.
- Stage 2: ورود/خروج، session قابل ابطال، PostgreSQL، نقش‌ها، tenant context، انتخاب مدرسه و تنظیمات حداقلی.
- Stage 3: جریان سه‌گامی ورود داده، ساختار/کلاس، curriculum، زمان مدرسه و workspace یکپارچه دبیر/حضور.
- Stage 4: پیش‌بررسی فارسی، solver قطعی CSP، validator مستقل، چند candidate و نتیجه قابل‌فهم.
- Stage 5: workspace واحد کلاس/دبیر، grid برنامه، اصلاح دستی امن، validation زمینه‌ای و چاپ.
- Stage 6: نسخه‌های immutable، انتشار و بایگانی، fork، تاریخچه، PDF/Excel/print و داشبورد واقعی.
- Stage 7: سخت‌سازی invariantهای DB و مرز خروجی، آزمون امنیت tenant و نشست، جریان کامل تولید مجدد، benchmark solver و راهنمای اجرای نهایی.
- اصلاح پس از فاز یک: مدل خط زمانی منعطف با break/transition مستقل، محاسبهٔ خودکار و override دستی، اعتبارسنجی دامنه/DB، نمایش ساعت دقیق در حضور و برنامه، و بازبینی کامل typography و رابط رندرشده.
- کالیبراسیون داده واقعی: curriculum وابسته به کلاس‌های سال، تخصیص سالانهٔ ساعت هر دبیر/درس، ظرفیت بدون دوباره‌شماری، جداسازی ساعت آموزشی از زنگ و fixture مستند تصاویر ۱۴۰۵–۱۴۰۶.
- داده نمایشی مدرسه واقعی: tenant مستقل شهید بهشتی و مجموعه یازده دبیر مرجع در هر سه مدرسه، همراه سناریوی متوازن و قابل تولید برای شهید بهشتی و دانا.
- اصلاح workspace دبیران: همگام‌سازی فرم با انتخاب دبیر، قفل اولیه مشخصات و refresh خودکار داده‌های سالانه و حضور پس از ذخیره.
- نمای یکپارچه رشته: ماتریس روز × (کلاس × زنگ) مطابق فرم مرجع، با فیلتر رشته، زمان واقعی، درس و دبیر و پشتیبانی واکنش‌گرا/چاپ.
- آماده‌سازی تحویل: seed امن تک‌مدرسه‌ای شهید بهشتی، دو حساب مدیر/معاون، ثبت حمید باقری به‌عنوان معاون و دبیر فارسی، و راهنمای استقرار و آزمون معاون.

## باقی‌مانده

- مورد مسدودکننده‌ای برای تعریف انجام‌شده Phase 1 باقی نمانده است؛ محدودیت‌های بالا برای توسعه‌های احتمالی آینده ثبت شده‌اند.
- استقرار روی حساب ابری هنوز انجام نشده و به نشانی ایمیل، دو رمز واقعی متفاوت، PostgreSQL مدیریت‌شده و دسترسی پروژه Vercel مالک نیاز دارد.
