# راه‌اندازی اعلان‌های واقعی هماهنگی

## قابلیت‌هایی که در کد آماده شده‌اند
- یادآوری زمان‌دار اندروید با Local Notifications؛ پس از زمان‌بندی، سیستم‌عامل حتی با بسته بودن برنامه اعلان را نمایش می‌دهد.
- ثبت توکن FCM هر دستگاه در مسیر خصوصی `users/{uid}/fcmTokens`.
- ارسال Push سمت سرور با Cloud Function هنگام ایجاد سند اعلان در `users/{uid}/notifications/{notificationId}`.
- اعلان پس‌زمینه وب/PWA از طریق Firebase Messaging Service Worker.
- حذف توکن‌های منقضی‌شده از Firestore پس از پاسخ FCM.

## تنظیمات لازم در Firebase Console
پروژه Firebase: `peak-amp-lxjsq`

1. در Project settings > General > Your apps، یک Android app با package name دقیق `ir.hamahangi.app` ثبت کنید.
2. در Firebase Authentication > Sign-in method، ورود با Google را فعال کنید.
3. برای اینکه ورود گوگل بومی اندروید کار کند، SHA-1 کلید امضای APK را در تنظیمات Android app ثبت کنید. برای Buildهای تکرارپذیر، یک debug keystore ثابت بسازید و آن را با Secret زیر به CI بدهید.
4. فایل `google-services.json` همان Android app را دانلود کنید. این فایل را در مخزن عمومی قرار ندهید.
5. در Firebase Console > Project settings > Cloud Messaging، کلید Web Push certificates (VAPID) بسازید/کپی کنید.
6. برای Cloud Functions، پروژه باید روی طرح Blaze باشد و سرویس‌های موردنیاز Google Cloud فعال باشند.
7. یک Service Account با دسترسی لازم برای Deploy Functions (از جمله Cloud Functions Admin، Service Account User و Firebase Admin در صورت نیاز) بسازید.

برای ساخت debug keystore ثابت (یک بار روی رایانه خود):
```bash
keytool -genkeypair -v -keystore hamahangi-debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
```
مقدار Base64 فایل را با این دستور بسازید و در Secret `ANDROID_DEBUG_KEYSTORE_BASE64` قرار دهید:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("hamahangi-debug.keystore"))
```
پس از Build، مقدار SHA-1 در لاگ مرحله `Show Android signing SHA-1` چاپ می‌شود؛ آن را در Firebase Console ثبت کنید و سپس فایل `google-services.json` را دوباره دانلود و Secret مربوط به آن را به‌روزرسانی کنید.

## GitHub repository secrets
در Settings > Secrets and variables > Actions این Secretها را اضافه کنید:

- `FIREBASE_SERVICE_ACCOUNT`: کل JSON کامل کلید Service Account؛ برای Deploy تابع سرور.
- `FIREBASE_VAPID_KEY`: کلید عمومی VAPID؛ برای ساخت نسخه وب/PWA.
- `GOOGLE_SERVICES_JSON_BASE64`: محتوای فایل google-services.json به صورت Base64؛ برای تزریق امن به ساخت APK اندروید.
- `ANDROID_DEBUG_KEYSTORE_BASE64`: کلید امضای debug ثابت به صورت Base64؛ برای ثابت ماندن SHA-1 و کارکرد پایدار ورود گوگل.

برای تولید مقدار Base64 فایل اندروید در PowerShell:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("google-services.json"))
```

پس از تنظیم Secretها، Workflow ساخت Android را دوباره اجرا کنید. Workflow جداگانه Deploy Functions نیز پس از Merge شدن کد به main یا با اجرای دستی قابل اجراست.

## محدودیت مهم
تا پیش از ثبت اپ اندروید در Firebase و قراردادن `GOOGLE_SERVICES_JSON_BASE64`، APK ساخته می‌شود و یادآوری‌های محلی اندروید کار می‌کنند، اما ثبت توکن FCM بومی و Push اندروید فعال نخواهد شد. تا پیش از قراردادن `FIREBASE_SERVICE_ACCOUNT` و فعال بودن طرح Blaze نیز تابع ارسال Push روی سرور Deploy نمی‌شود. برای وب Push، کلید VAPID لازم است.

## آزمون انتها به انتها
1. APK جدید را نصب کنید و با حساب گوگل وارد شوید.
2. در اعلان‌ها، مجوز اعلان را فعال کنید.
3. یک جلسه آزمایشی با یادآوری ۵ دقیقه‌ای برای چند دقیقه بعد ثبت کنید.
4. برنامه را کامل ببندید و منتظر اعلان زمان‌دار بمانید.
5. از حساب دیگری در همان گروه یک اعلان ایجاد کنید و دریافت Push روی دستگاه دوم را بررسی کنید.
