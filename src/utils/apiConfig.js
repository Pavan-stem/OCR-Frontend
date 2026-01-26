/**
 * Get the API base URL based on the current environment
 * - In development (localhost or local IP): uses local backend server
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
  // Support both localhost AND local IP addresses (for mobile testing)
  const hostname = window.location.hostname;
  const port = window.location.port;

  console.log(`[API Config] Detected hostname: ${hostname}, port: ${port}`);

  // Check if it's localhost, 127.0.0.1, or a private IP
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isPrivateIP = /^(192\.168\.|10\.|172\.1[6-9]\.|172\.2[0-9]\.|172\.3[01]\.)/.test(hostname);

  if (isLocalhost || isPrivateIP) {
    // Use local backend server on port 5004 with detected IP
    const apiUrl = `http://${hostname}:5004/OCR`;
    console.log(`[API Config] Using local backend: ${apiUrl}`);
    return apiUrl;
  }

  // 3️⃣ Production (deployed site)
  console.log(`[API Config] Using production backend`);
  return "https://api.stemverse.app/OCR";
};

export const getAuthApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const isPrivateIP = /^(192\.168\.|10\.|172\.1[6-9]\.|172\.2[0-9]\.|172\.3[01]\.)/.test(hostname);

    if (isLocalhost || isPrivateIP) {
      return `http://${hostname}:5004/OCR`;
    }
  }

  return "https://api.stemverse.app/OCR";
};

export const API_BASE = getApiBase();
export const AUTH_API_BASE = getAuthApiBase();

// Log which API is being used
console.log(`[API Config] API_BASE initialized to: ${API_BASE}`);

