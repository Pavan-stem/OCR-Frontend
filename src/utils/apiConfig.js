/**
 * Get the API base URL based on the current environment
 * - In development (localhost): uses local backend server
 * - In production: uses relative path or production API
 */
export const getApiBase = () => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return '/OCR';
  }

  // Check environment variable first
  if (import.meta.env.VITE_OCR_API_URL) {
    return import.meta.env.VITE_OCR_API_URL;
  }

  // In development (localhost), use local backend
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'https://api.stemverse.app/OCR';
  }

  // In production, use relative path
  // This will work with the vite proxy or direct backend connection
  return window.location.origin + '/OCR';
};

export const getAuthApiBase = () => {
  // Check environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // In development (localhost), use local backend
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'https://api.stemverse.app/OCR';
  }

  // In production, use origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
};

// Export the API base URL as a constant
export const API_BASE = getApiBase();
export const AUTH_API_BASE = getAuthApiBase();

