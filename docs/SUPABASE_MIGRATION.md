# مهاجرت هماهنگی از Firebase به Supabase

این شاخه، نسخه آزمایشی مهاجرت کامل برنامه به Supabase Cloud است. شاخه اصلی و پروژه Firebase قدیمی تا پایان آزمون‌ها دست‌نخورده می‌مانند.

## معماری هدف

- احراز هویت: Supabase Auth با ایمیل و رمز عبور، ثبت‌نام، ورود، خروج و بازیابی رمز.
- پایگاه داده: PostgreSQL در Supabase برای پروفایل‌ها، گروه‌ها، اعضا، جلسات/کارها/رویدادها، دعوت‌ها و اعلان‌ها.
- امنیت: RLS و توابع RPC محدود برای ایجاد گروه، پذیرش/رد دعوت، تغییر نقش و حذف عضو.
- همگام‌سازی زنده: Supabase Realtime روی جدول‌های دامنه؛ دسترسی داده همچنان تحت RLS است.
- یادآوری: Capacitor Local Notifications روی اندروید و اعلان مرورگر؛ هیچ FCM یا سرویس Push خارجی استفاده نمی‌شود.
- داده: این نسخه با دیتابیس خالی آغاز می‌شود؛ مهاجرت داده‌های Firebase در محدوده این نسخه نیست.

## وضعیت پیاده‌سازی

- [x] ایجاد شاخه مستقل و PR آزمایشی.
- [x] ایجاد schema اولیه و سیاست‌های RLS.
- [x] سخت‌سازی مجوزهای نوشتن و RPC پذیرش/رد دعوت.
- [x] افزودن RPCهای امن مدیریت اعضا و فعال‌سازی Realtime (migration سوم).
- [x] افزودن کلاینت Supabase و متغیرهای محیطی.
- [x] جایگزینی صفحه ورود با ایمیل/رمز عبور، ثبت‌نام و بازیابی رمز.
- [x] جایگزینی سرویس داده Firestore با Postgres و RPC.
- [x] بازنویسی Context برای Supabase Auth، queryها و Realtime.
- [x] حذف مسیر FCM از اعلان‌ها و حفظ یادآوری محلی.
- [ ] اجرای migration سوم در پروژه Supabase.
- [x] TypeScript، lint و build وب در GitHub Actions موفق شده‌اند.
- [ ] ساخت APK پس از افزودن Secret با نام `SUPABASE_PUBLISHABLE_KEY`؛ بدون کلید، مرحله Android عمداً اجرا نمی‌شود.
- [ ] آزمون واقعی ثبت‌نام/ورود/بازیابی رمز با SMTP.
- [ ] آزمون دو حساب و نقش‌های مختلف برای RLS، دعوت و تغییر عضویت.
- [ ] ساخت و نصب APK و آزمون اعلان‌های محلی در Android.

## تنظیمات Supabase

در Supabase → Authentication → Providers → Email، ورود ایمیل/رمز عبور فعال باشد. برای آزمون اولیه می‌توان تأیید ایمیل را موقتاً غیرفعال کرد. برای استفاده واقعی، تأیید ایمیل و SMTP معتبر لازم است؛ بدون SMTP بازیابی رمز قابل اتکا نیست.

در Project Settings → API، مقادیر زیر را در فایل محلی `.env.local` قرار دهید:

```env
VITE_SUPABASE_URL=https://cyufuqdfalkpotjlxkhu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=کلید-publishable-پروژه
```

کلید Publishable/anon برای کلاینت است؛ هرگز service_role key یا رمز دیتابیس را در برنامه یا Git قرار ندهید.

### SQL migrations

سه migration نخست قبلاً توسط مالک پروژه اجرا شده‌اند. migration چهارم باید در SQL Editor اجرا شود:

1. `supabase/migrations/202611190001_initial_schema.sql`
2. `supabase/migrations/202611190002_security_hardening.sql`
3. `supabase/migrations/202611190003_realtime_and_membership_rpcs.sql`
4. `supabase/migrations/202611200001_owner_role_permissions.sql`

اگر سه migration قبلی را اجرا کرده‌اید، فقط migration چهارم را اجرا کنید؛ فایل‌های قبلی را مجدداً اجرا نکنید. migration چهارم جدول تنظیم دسترسی نقش‌ها و کنترل مجوزها در سطح دیتابیس را اضافه می‌کند.

## CI و APK

در GitHub → Settings → Secrets and variables → Actions:
- Secret با نام `SUPABASE_PUBLISHABLE_KEY` و مقدار Publishable key تعریف شود.
- در صورت تمایل Variable با نام `SUPABASE_URL` تعریف شود؛ در غیر این صورت URL پروژه پیش‌فرض استفاده می‌شود.

پس از push/PR، workflow باید TypeScript، lint، web build و Android debug APK را اجرا کند. موفقیت build به‌تنهایی جایگزین آزمون چندکاربره و امنیت RLS نیست.

## محدودیت‌های نسخه آزمایشی

- Push notification از راه دور در این مرحله پیاده‌سازی نشده است. اعلان‌های جدید هنگام آنلاین بودن برنامه از طریق Realtime دریافت می‌شوند؛ یادآوری‌های زمان‌بندی‌شده روی دستگاه محلی‌اند.
- برای دریافت تغییرات لحظه‌ای در حالت بسته بودن اپ، سرویس Push مستقل لازم است و فعلاً خارج از محدوده است.
- تا قبل از تست چندحسابی و بررسی سیاست‌ها، از داده حساس یا سازمانی واقعی استفاده نشود.
