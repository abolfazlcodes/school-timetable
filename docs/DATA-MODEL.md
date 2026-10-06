# مدل داده فاز یک

## هویت و tenancy

- `users`: هویت سراسری، ایمیل و password hash
- `schools`: مشخصات و تنظیمات یک مدرسه
- `school_memberships`: ارتباط کاربر/مدرسه با نقش ADMIN یا VICE_PRINCIPAL
- `sessions`: digest نشست، کاربر، مدرسه فعال و انقضا

این چهار جدول در migration `0000_auth_and_schools.sql` پیاده شده‌اند. foreign key مرکب session تضمین می‌کند `(user_id, active_school_id)` حتماً یک membership واقعی باشد. ایمیل normalize‌شده یکتا، token digest یکتا و session قابل revoke است. جداول ورودی برنامه‌ریزی در `0001_planning_inputs.sql` و کنترل‌های مرکب/الگوی جلسه در `0002_planning_invariants.sql` پیاده شده‌اند. Migrationهای `0006` تا `0010` نیز عضویت actorها، timeline، زنجیره snapshot و تخصیص‌های سالانه درس/دبیر و کلاس/درس/دبیر را در PostgreSQL enforce می‌کنند.

## ساختار آموزشی

- `academic_years`: عنوان، بازه، وضعیت جاری؛ تاریخچه حذف نمی‌شود
- `grades`: پایه در یک مدرسه
- `majors`: رشته/شاخه در یک مدرسه
- `class_plans`: ورودی تجمیعی تعداد دانش‌آموز، ظرفیت، پیشنهاد و override برای یک پایه/رشته
- `class_groups`: کلاس در یک سال، پایه و رشته اختیاری، ظرفیت و تعداد دانش‌آموز
- `subjects`: تعریف قابل استفاده مجدد درس در مدرسه
- `curriculum_items`: قاعدهٔ برنامهٔ درسی برای سال/پایه/رشته/درس شامل ساعت هر کلاس، تعداد جلسات و pattern صریح همان ردیف؛ پیش‌فرض مدرسه هنگام آماده‌سازی داده اعمال می‌شود و معاون می‌تواند آن را پیش از تولید تغییر دهد
- `LessonRequirement` (مدل دامنه): نیاز واقعی یک درس برای یک کلاس
- `RequiredSession` (مدل دامنه): جلسه مشتق‌شده از requirement که هنوز زمان‌بندی نشده است

این دو مفهوم از `ScheduleAssignment` جدا هستند: curriculum می‌گوید «هر کلاس این دامنه چند ساعت درس دارد»، requirement/session می‌گویند «با کلاس‌های فعال امسال چه چیزی باید تدریس شود» و assignment می‌گوید «در کدام روز و زنگ و با کدام دبیر قرار گرفته است». نیاز کل هر دامنه دقیقاً `active class count × weekly hours per class` است؛ با صفر کلاس، نیاز هم صفر می‌شود. requirementها از curriculum و کلاس‌های همان سال ساخته و assignmentها داخل snapshotهای candidate/workspace/version ذخیره می‌شوند.

## منابع انسانی

- `teachers`: اطلاعات پایدار شخص؛ `staff_kind` نقش آموزشی/اجرایی را بدون استثنای hardcoded ثبت می‌کند. حداقل یکی از نام یا نام خانوادگی لازم است تا اشخاصی مانند «هاشمی» بدون ساختن نام جعلی ثبت شوند.
- `teacher_subject_assignments`: تخصیص چندبه‌چند دبیر/درس برای یک سال همراه ساعت پوشش همان درس
- `class_subject_teacher_assignments`: انتخاب قطعی دبیر یک درس برای یک کلاس در همان مدرسه و سال
- `teacher_year_profiles`: min/required/max workload و overtime برای یک سال
- `teacher_availability`: وضعیت AVAILABLE/UNAVAILABLE/PREFERRED/RESTRICTED برای day/period یک سال

`teachers` اطلاعات قابل استفاده مجدد شخص را نگه می‌دارد، اما درس‌ها، ساعت هر درس، موظفی، حضور و تخصیص هر کلاس همگی با `academic_year_id` نسخه‌دارند. `teacher_subject_assignments` ظرفیت تجمیعی پوشش یک درس را بیان می‌کند و `class_subject_teacher_assignments` مشخص می‌کند جلسه‌های همان درس در یک کلاس دقیقاً به کدام دبیر تعلق دارند؛ این دو مفهوم جای یکدیگر را نمی‌گیرند. بنابراین یک دبیر می‌تواند در دو سال درس‌ها، کلاس‌ها و ساعت متفاوت داشته باشد و تاریخچه بازنویسی نشود. `staff_kind` شامل دبیر، معاون و سایر کارکنان دارای مسئولیت تدریس است؛ solver همه را یک منبع زمان‌بندی‌شونده می‌بیند و استثنای hardcoded ندارد.

`required_workload` موظفی پایه است. ساعت تخصیص‌یافته بیشتر از آن، تا سقف مجاز، اضافه‌کار محسوب می‌شود و مغایرت نیست. برای snapshot شهید بهشتی، موظفی دبیران تمام‌وقت ۲۴ ساعت است؛ برای نمونه ۲۷ ساعت امیر چگینی به‌صورت ۲۴ ساعت موظفی و ۳ ساعت اضافه‌کار ثبت می‌شود. پروفایل دبیران کم‌ساعت‌تر جداگانه و سالانه باقی می‌ماند.

## ساختار زمان

- `school_days`: روز کاری و ترتیب در یک سال
- `school_day_schedules`: تنظیم خط زمانی روز شامل شروع/پایان مدرسه، تعداد زنگ، حالت `AUTO`/`MANUAL` و استراحت پیش‌فرض
- `periods`: slot دارای هویت پایدار، بازه شروع/پایان و `instructional_units` قابل تنظیم برای هر روز؛ مدت ساعت رسمی و ظرفیت آموزشی زنگ دو مفهوم مستقل‌اند
- `school_breaks`: فاصلهٔ مستقل میان دو زنگ با نوع `BREAK` یا `TRANSITION`، موقعیت، شروع و پایان؛ slot قابل تخصیص نیست

`break_after_minutes` قدیمی فقط برای سازگاری داده‌ای باقی مانده و منبع حقیقت رابط جدید نیست. خط زمانی معتبر باید از شروع مدرسه، زنگ‌ها و فاصله‌های صریح بدون overlap یا gap تا پایان مدرسه ادامه پیدا کند. constraint trigger پایگاه‌داده این invariant را بعد از پایان transaction کنترل می‌کند.

## برنامه

- `schedule_runs`: ورودی، fingerprint، زمان، نتیجه preflight و آمار اجرا
- `schedule_candidates`: rank، امتیاز، penalty breakdown و placementهای معتبر هر اجرا
- `schedule_workspaces`: snapshot کاری قابل ویرایش از candidate، نتیجه آخرین validation و revision برای جلوگیری از overwrite هم‌زمان
- `schedule_versions`: snapshot تغییرناپذیر assignmentها و validation، شماره، DRAFT/PUBLISHED/ARCHIVED، منبع workspace/run/candidate، actor و زمان انتشار

در Stage 4، `schedule_runs` و `schedule_candidates` در migration `0003_schedule_runs.sql` ایجاد شدند. Stage 5 در migration `0004_schedule_workspaces.sql` یک snapshot کاری tenant-scoped اضافه کرد؛ assignmentها و issueهای validation آن به‌صورت یک واحد و با `revision` اتمیک ذخیره می‌شوند. Stage 6 در migration `0005_schedule_versions.sql` snapshotهای immutable نسخه را اضافه کرد. هر نسخه به workspace، run و candidate منبع متصل است و یک نسخه منتشرشده در هر مدرسه/سال مجاز است. fork نسخه تاریخی workspace جدیدی با `source_version_id` می‌سازد و نسخه مبدا را تغییر نمی‌دهد.

## invariantهای اصلی

- تمام foreign keyهای سالانه باید متعلق به همان `school_id` باشند؛ service آن را پیش از write و constraintهای مرکب DB آن را در موارد حساس enforce می‌کنند.
- فقط یک سال جاری در هر مدرسه وجود دارد (partial unique index).
- فقط یک نسخه منتشرشده فعال برای سال/مدرسه وجود دارد.
- سازنده run/workspace/version و منتشرکننده نسخه باید عضو همان مدرسه باشند.
- workspace و version فقط می‌توانند به run/candidate/version مبدا در همان مدرسه و سال متصل شوند.
- JSON مسئله‌ها array و summary/penalty breakdown object است؛ نسخه PUBLISHED نمی‌تواند issue با شدت `ERROR` داشته باشد.
- امتیاز ذخیره‌شده نسخه در بازه صفر تا ۱۰٬۰۰۰ است.
- ساعت هر کلاس و تعداد جلسه مثبت است و مجموع pattern دقیقاً برابر ساعات هفتگی آن کلاس است.
- جمع تخصیص یک درس از ردیف‌های همان مدرسه و سال محاسبه می‌شود؛ foreign keyهای مرکب اتصال دبیر/درس/سال مدرسه دیگر را رد می‌کنند.
- تخصیص قطعی کلاس/درس/دبیر فقط می‌تواند به کلاس، درس و دبیر همان مدرسه و سال اشاره کند و برای هر کلاس/درس یکتا است.
- `min_workload <= required_workload <= max_workload`; overtime منفی نیست.
- بازهٔ هر period/break مثبت و داخل ساعت مدرسه است؛ positionها یکتا و پیوسته‌اند و کل timeline بدون overlap یا gap دقیقاً به پایان مدرسه می‌رسد.
- پایه، رشته، سال و مدرسه هر class group باید دقیقاً با class plan آن یکسان باشد.
- هر session در یک period مدرسه قرار می‌گیرد؛ مقدار pattern بار آموزشی جلسه است و طول ساعت‌دار period مفهوم جداگانه‌ای دارد.
- snapshot برنامه منتشرشده مستقیم ویرایش نمی‌شود.
- هر placement دارای الگوی هفته `EVERY_WEEK`، `WEEK_A` یا `WEEK_B` است؛ نبود این فیلد فقط برای snapshotهای قدیمی به معنی هر هفته تفسیر می‌شود.
- اشغال کلاس/دبیر با کلید روز + زنگ + هفته چرخه کنترل می‌شود؛ بنابراین دو جلسه یک‌ساعته می‌توانند در هفته‌های مخالف یک زنگ دوواحدی را به‌طور معتبر شریک شوند.

## پیشنهاد تعداد کلاس

`ceil(studentCount / maxClassCapacity)` پیشنهاد می‌شود. مقدار override جداگانه ذخیره می‌شود تا هم پیشنهاد قابل بازتولید باشد و هم تصمیم مدیر از بین نرود. مقدارهای صفر/منفی یا ظرفیت کمتر از یک رد می‌شوند.

هنگام ذخیره plan، دانش‌آموزان تا حد ممکن یکنواخت بین کلاس‌ها توزیع می‌شوند. overrideای که ظرفیت کافی ایجاد نکند پیش از write رد می‌شود. کاهش تعداد، کلاس‌های اضافه را غیرفعال می‌کند تا نام و سابقه آن‌ها حذف نشود.
