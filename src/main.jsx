import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AppRoutes from "./AppRoutes";
import "./index.css";
import "./styles.css";
import { LanguageProvider } from './contexts/LanguageContext';

// Unregister any service workers that might interfere with API calls
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      console.log('Unregistering service worker:', registration.scope);
      registration.unregister().then(success => {
        if (success) {
          console.log('✅ Service worker unregistered successfully');
        }
      }).catch(err => {
        console.warn('Warning: Could not unregister service worker:', err);
      });
    });
  }).catch(err => {
    console.warn('Warning: Could not get service worker registrations:', err);
  });
}

import { setupAuthInterceptor } from './utils/authInterceptor';

// Initialize global authentication interceptor
setupAuthInterceptor();

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <LanguageProvider>
      <AppRoutes />
    </LanguageProvider>
  </StrictMode>
);
