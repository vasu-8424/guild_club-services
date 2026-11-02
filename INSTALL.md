# Guild Club Services — App Installation Guide

This guide describes how to install **Guild Club Services** on Android devices and iPhones for a native full-screen app experience.

---

## 1. Android Installation (PWA or APK)

### Method A: Install directly from Chrome Browser (PWA)
1. Open Google Chrome on your Android phone and navigate to the clinic URL:  
   `https://<your-vercel-or-server-domain>`
2. An **"Install Guild Club App"** banner will automatically appear at the top of your dashboard.
3. Tap **"Install App"** (or tap the three-dot menu `⋮` in Chrome and select **"Add to Home screen"** / **"Install app"**).
4. Tap **Install** in the system confirmation prompt.
5. The Guild Club Services icon will be added to your home screen and app drawer. It opens full screen with no browser address bar and brand splash screen.

### Method B: Install Android APK
1. Download the latest debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`.
2. Transfer or download the APK to your Android device.
3. Tap the file in Files/Downloads. If prompted, allow "Install unknown apps" for your browser or file manager.
4. Tap **Install** and then **Open**.

---

## 2. iPhone (iOS) Installation (Safari)

> **Important Note for iOS Users:**  
> Apple iOS only allows Progressive Web Apps to be installed from **Apple Safari**. Third-party browsers on iOS (such as Google Chrome, Firefox, or Edge) cannot add web applications to the Home Screen due to iOS restrictions.

### Step-by-Step for Safari on iPhone:
1. Open **Safari** on your iPhone.
2. Navigate to the clinic URL:  
   `https://<your-vercel-or-server-domain>`
3. Tap the **Share** button at the bottom of Safari (the square icon with an upward-pointing arrow).
4. Scroll down the share sheet and tap **"Add to Home Screen"** (`[+] Add to Home Screen`).
5. Confirm the app title **"Guild Club"** and tap **Add** in the top-right corner.
6. The app icon will now appear on your iPhone Home Screen. Tapping it launches Guild Club Services in dedicated standalone mode with safe-area padding and no Safari navigation bars.

---

## 3. Offline Mode & Data Security
- When an internet connection is unavailable, Guild Club Services displays a friendly offline page.
- **Privacy & Compliance**: In accordance with healthcare data regulations, **no patient records, medical condition photos, clinical notes, or signatures are ever stored or cached on the device**. Only static app shell assets and brand icons are saved for rapid loading.
