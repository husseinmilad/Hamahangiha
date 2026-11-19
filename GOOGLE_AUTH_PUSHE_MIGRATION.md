# مهاجرت ورود گوگل و اعلان‌ها (Firestore حفظ می‌شود)

## دامنه
- Firestore، شناسه اسناد، قواعد امنیتی و Firebase Authentication به‌عنوان لایه نشست/مجوز Firestore حفظ می‌شوند.
- ورود بومی اندروید با Google Credential Manager انجام می‌شود و Google ID Token به تابع `googleAuthExchange` فرستاده می‌شود.
- تابع، توکن را با Google OAuth Client ID بررسی می‌کند و Firebase Custom Token صادر می‌کند.
- حساب‌های Google موجود با همان Firebase UID حفظ می‌شوند؛ اگر ایمیل به حسابی غیر از همان Google subject تعلق داشته باشد، ورود با خطای تعارض متوقف می‌شود.
- یادآوری‌های محلی Capacitor بدون تغییر باقی می‌مانند.

## Secrets موردنیاز

در GitHub > Settings > Secrets and variables > Actions:

- `GOOGLE_WEB_CLIENT_ID`: OAuth 2.0 Web client ID پروژه Google Cloud/Firebase. باید همان audience مورد انتظار توکن Android باشد.
- `PUSHE_MANIFEST_TOKEN`: توکن مانیفست Android از پنل پوشه. این توکن با REST API token متفاوت است.
- `PUSHE_REST_API_TOKEN`: کلید REST API برای ارسال اعلان از سرور (مرحله ارسال سروری).
- `PUSHE_APP_ID`: شناسه اپلیکیشن در پنل پوشه.

پس از تنظیم `GOOGLE_WEB_CLIENT_ID`، تابع `googleAuthExchange` را Deploy کنید. در صورت استفاده از Secret جدید، اجرای مجدد workflow استقرار لازم است.

## وضعیت پوشه
CI در صورت وجود `PUSHE_MANIFEST_TOKEN` کتابخانه رسمی Android پوشه نسخه 2.6.3 را اضافه و توکن مانیفست را تزریق می‌کند. SDK دستگاه را ثبت می‌کند. برای هدف‌گیری اعلان بر اساس کاربر، باید شناسه سفارشی پایدار Firebase UID به SDK متصل و سپس Cloud Function ارسال اعلان از FCM به REST API پوشه منتقل شود؛ این بخش تا تکمیل پل بومی Capacitor و تست API، فعال تلقی نمی‌شود.

### محدودیت مهم FCM
طبق مستندات رسمی پوشه، روی دستگاه‌های دارای Google Play Services، ماژول FCM خود پوشه مسیر انتقال Push است. روی دستگاه‌های فاقد Google Play Services و سازگار با Huawei، ماژول HMS/PushKit قابل استفاده است. بنابراین پوشه مدیریت Push را ساده می‌کند، اما وابستگی FCM را روی گوشی‌های دارای Google Play Services حذف نمی‌کند. این موضوع باید در تست میدانی ایران به‌صراحت سنجیده شود.

## آزمون پذیرش
1. ورود با حساب Google موجود و بررسی حفظ UID و داده‌های Firestore.
2. رد شدن توکن با audience اشتباه یا ایمیل تأییدنشده.
3. نصب APK با Pushe manifest token و مشاهده ثبت نصب در پنل پوشه.
4. دریافت اعلان آزمایشی از پنل پوشه در حالت foreground، background و force-stop (محدودیت‌های سیستم‌عامل ثبت شود).
5. تست روی حداقل یک دستگاه دارای Google Play Services و یک دستگاه فاقد آن با HMS.
6. پس از آماده‌شدن پل شناسه کاربر و REST sender، تست اعلان هدفمند برای یک کاربر و عدم دریافت آن توسط حساب دیگر.
