/**
 * Get the API base URL based on the current environment
 * - In development (localhost): uses local backend server
 * - In production: uses relative path or production API
 */
export const getApiBase = () => {
  // Browser check
  if (typeof window === "undefined") return "/OCR";

  // 1️⃣ Environment variable takes highest priority
  if (import.meta.env.VITE_OCR_API_URL) {
    return import.meta.env.VITE_OCR_API_URL;
  }

  // 2️⃣ Local development (React dev server)
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    // Use HTTP for local backend (Flask dev server) to avoid SSL protocol errors
    return "https://api.stemverse.app/OCRtest";
  }

  // 3️⃣ Production (deployed site)
  return "https://api.stemverse.app/OCR";
};

export const getAuthApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    return "https://api.stemverse.app/OCRtest";
  }

  return "https://api.stemverse.app/OCR";
};

export const API_BASE = getApiBase();
export const AUTH_API_BASE = getAuthApiBase();

