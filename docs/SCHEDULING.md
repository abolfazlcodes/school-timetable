# معماری زمان‌بندی

## هدف

موتور مستقل از Next.js و دیتابیس است: یک `SchedulingProblem` خالص دریافت می‌کند و `ScheduleCandidate[]` یا گزارش `NoSolution` می‌دهد. ورودی canonical می‌شود و با seed و نسخه الگوریتم fingerprint دارد؛ بنابراین نتیجه با ورودی یکسان بازتولیدپذیر است. هیچ LLM یا تولید تصادفی در تصمیم‌گیری استفاده نمی‌شود.

## فرایند

1. preflight صحت و کفایت داده را بدون اجرای solver بررسی می‌کند.
2. curriculum به `LessonRequirement` و سپس sessionهای دارای duration تبدیل می‌شود.
3. برای هر session، domain همه `(day, startPeriod, teacher)`های مجاز ساخته می‌شود.
4. propagation گزینه‌های ناقض قیود سخت را حذف می‌کند.
5. جست‌وجوی CSP با MRV و tie-break پایدار، session بعدی را انتخاب می‌کند.
6. forward checking پس از هر placement دامنه متغیرهای مرتبط را کاهش می‌دهد.
7. branch-and-bound شاخه‌هایی را که نمی‌توانند score فعلی را بهتر کنند حذف می‌کند.
8. solutionهای متمایز با signature یکتا تا حد پیکربندی‌شده جمع‌آوری می‌شوند.
9. validator مستقل تمام نتیجه را دوباره بررسی و issueهای فارسی تولید می‌کند.

## قیود سخت

- یک کلاس و یک معلم در یک slot فقط یک جلسه دارند.
- همه periodهای duration جلسه موجود، فعال، متوالی و در یک روزند.
- availability معلم و محدودیت روزانه رعایت می‌شود.
- تعداد جلسه، duration و ساعت curriculum کامل است.
- assignment درس/معلم معتبر و workload حداکثر (با overtime مجاز) رعایت می‌شود.
- constraintهای با severity `HARD` هرگز به preference تبدیل نمی‌شوند.
- resource/room در فاز یک schema توسعه دارد ولی تا زمان فعال‌شدن feature وارد مسئله نمی‌شود.

اگر هیچ solution سخت معتبری وجود نداشته باشد، موتور برنامه ناقص/نامعتبر را به‌عنوان موفقیت برنمی‌گرداند.

## قیود نرم و امتیاز

امتیاز پایه ۱۰۰ است و penalty نرمال‌شده کم می‌شود. وزن‌ها configuration مدرسه و نسخه engine هستند:

- خارج از روز/period ترجیحی
- gap معلم یا کلاس
- تدریس متوالی بیش از ترجیح
- عدم توازن بار روزانه
- توزیع نامناسب جلسات یک درس
- period پایانی غیرضروری
- فاصله workload از required

خروجی هم امتیاز کل و هم breakdown هر penalty را ارائه می‌دهد. tieها با ترتیب پایدار شناسه‌ها شکسته می‌شوند.

## چند candidate

پس از solution نخست، signature آن منع می‌شود و جست‌وجو برای candidate بعدی ادامه دارد. سقف candidate و time/node budget پیکربندی می‌شود. candidate کمتر از درخواست‌شده failure نیست؛ در UI دلیل (فضای حل کوچک یا اتمام budget) نمایش داده می‌شود.

## preflight و no-solution

preflight مواردی مانند curriculum ناقص، نبود assignment، availability خالی، کمبود ظرفیت teacher-slot، pattern نامعتبر و نبود period را با entity reference گزارش می‌دهد. در no-solution، موتور از conflict-setهای ثبت‌شده در propagation یک توضیح سطح دامنه می‌سازد؛ raw stack/solver clause نمایش داده نمی‌شود.

## ویرایش دستی

Stage 5 هر candidate را immutable نگه می‌دارد و برای اصلاح از آن یک `schedule_workspace` می‌سازد. عملیات move، تغییر روز/زنگ/دبیر، add، remove و swap ابتدا در حافظه روی یک کپی اعمال و سپس با همان `validateSchedule` مستقل بررسی می‌شوند.

- خطای سخت تازه mutation را رد می‌کند و پیام فارسی مرتبط با همان جلسه نمایش داده می‌شود.
- هشدار نرم تازه تا تأیید صریح کاربر ذخیره نمی‌شود.
- برداشتن جلسه تنها استثنای آگاهانه است: با تأیید صریح ذخیره می‌شود، workspace را واضحاً نامعتبر نشان می‌دهد و جلسه در فهرست جایگذاری‌نشده‌ها برای add باقی می‌ماند.
- update پایگاه داده با `revision` انجام می‌شود تا دو ویرایش هم‌زمان یکدیگر را بی‌صدا overwrite نکنند.
- پس از هر mutation موفق، کل برنامه دوباره اعتبارسنجی و issueهای جدید همراه snapshot ذخیره می‌شوند.

نسخهٔ کاری معتبر می‌تواند به snapshot پیش‌نویس یا منتشرشده تبدیل شود. publish هرگز خطای سخت را نمی‌پذیرد و برای هشدارها تأیید صریح می‌گیرد. نسخه تاریخی مستقیم تغییر نمی‌کند؛ fork آن یک workspace مستقل می‌سازد. انتشار جدید، نسخه منتشرشده قبلی همان مدرسه/سال را بایگانی می‌کند.

## محدودیت‌های اولیه

- benchmark مرجع Stage 7 مسئله‌ای شامل ۱۲ کلاس، ۴۸ جلسه، ۸ دبیر و ۳۰ slot هفتگی را در budget سه‌ثانیه‌ای حل و خروجی را مستقل بدون hard error اعتبارسنجی می‌کند. این benchmark معیار regression است، نه تضمین زمان برای همه اندازه‌ها.
- حل دقیق مدارس بسیار بزرگ‌تر به node/time budget وابسته است؛ معماری engine اجازه جایگزینی adapter با OR-Tools service را بدون تغییر دامنه/UI می‌دهد.
- room/resource تا وقتی feature فعال نشده در generation لحاظ نمی‌شود.
- تقویم برای نمایش فارسی است؛ محاسبات داخلی با تاریخ ISO انجام می‌شود.

## وضعیت پیاده‌سازی Stageهای 4 تا 6

موتور خالص TypeScript در `src/modules/scheduling` پیاده شده و هیچ وابستگی به React، Next.js یا ORM ندارد. repository فقط snapshot مرتب‌شدهٔ ورودی را می‌سازد و نتیجه را بعد از validation مستقل ذخیره می‌کند.

- `preflight.ts`: نبود کلاس/curriculum/دبیر/profile/حضور/زنگ و کمبود ظرفیت را قبل از حل گزارش می‌کند.
- `solver.ts`: domain construction، انتخاب MRV، forward checking، branch-and-bound، signature یکتا و جمع‌آوری حداکثر سه candidate.
- `validator.ts`: required session، duration، توالی period، مجوز درس دبیر، availability، تداخل کلاس/دبیر، workload و محدودیت روزانه را مستقل از solver دوباره کنترل می‌کند.
- `service.ts`: fingerprint شامل نسخه engine و snapshot canonical است؛ هیچ random seed یا انتخاب تصادفی وجود ندارد.
- `src/modules/timetable/editor.ts`: تغییر placement، تعویض، برداشتن و مقایسه issueهای قبل/بعد را بدون وابستگی به UI/DB انجام می‌دهد.
- `src/modules/timetable/service.ts`: مجوز، validation، تأیید هشدار/حذف و optimistic concurrency را هماهنگ می‌کند.
- `src/modules/schedule-versions`: snapshot، وضعیت، انتشار اتمیک، تاریخچه tenant-scoped و fork نسخه را هماهنگ می‌کند.
- `src/modules/exports`: مدل خروجی مشترک، PDF با فونت فارسی embedشده و SpreadsheetML راست‌به‌چپ سازگار با Excel را می‌سازد.

`UNAVAILABLE` و `RESTRICTED` هر دو خارج از domain و hard هستند. سقف مطلق هفتگی برابر `maximum_workload + overtime_allowance` است. `daily_maximum` و `max_consecutive` hard هستند. فاصله از `required_workload`، gapها، period پایانی، تکرار یک درس در یک روز و عدم استفاده از slot ترجیحی penalty نرم می‌گیرند. حداقل workload در preflight هشدار می‌دهد، زیرا ممکن است کل تقاضای درس از حداقل یک دبیر کمتر باشد و تبدیل آن به hard constraint مسئله صحیح مدرسه را بی‌دلیل ناممکن کند.

بودجه پیش‌فرض ۱۵۰٬۰۰۰ node یا ۳ ثانیه است. اگر جواب معتبر پیش از سقف پیدا شود ذخیره می‌شود و رسیدن به سقف فقط درباره گزینه‌های بیشتر هشدار می‌دهد؛ اگر جواب پیدا نشود هیچ جدول ناقصی به‌عنوان موفق نمایش داده نمی‌شود.

benchmark با `npm run benchmark:scheduling` اجرا می‌شود و علاوه بر موفقیت solver، نتیجه را دوباره با `validateSchedule` بررسی می‌کند. به همین دلیل سریع‌تر شدن ظاهری با حذف اعتبارسنجی یا تضعیف hard constraint قابل قبول نیست.
