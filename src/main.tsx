import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './index.css';
import App from './App';

async function bootstrap() {
  const isNative = Capacitor.isNativePlatform();

  if (isNative && 'serviceWorker' in navigator) {
    // Remove workers left by earlier APK versions. A controlled WebView can
    // block Capacitor's native plugin bridge even after the worker is disabled.
    const hadController = Boolean(navigator.serviceWorker.controller);
    const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
    if (registrations.length > 0) {
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if (hadController && !sessionStorage.getItem('hamahangi_sw_cleared')) {
      sessionStorage.setItem('hamahangi_sw_cleared', '1');
      window.location.reload();
      return;
    }
  } else if (!isNative && 'serviceWorker' in navigator && import.meta.env.PROD) {
    // Register the PWA worker only on the web build, never inside Capacitor.
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('./sw.js').catch((error) => {
        console.warn('PWA service worker registration failed', error);
      });
    });
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void bootstrap();
