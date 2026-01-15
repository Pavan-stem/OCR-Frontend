import { API_BASE } from './apiConfig';

/**
 * Enhanced fetch wrapper that handles:
 * 1. Automatic Authorization header attachment
 * 2. Centralized error handling
 * 3. Automatic logout on token expiration (401 with 'expired_token' error)
 */
const apiClient = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');

    // Set default headers
    const headers = {
        ...options.headers,
    };

    // Add token if available
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // If body is an object and not FormData, stringify it
    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
        body = JSON.stringify(body);
        headers['Content-Type'] = 'application/json';
    }

    const config = {
        ...options,
        headers,
        body,
    };

    try {
        const response = await fetch(endpoint, config);

        // Handle generic errors (e.g., 401 logout)
        if (response.status === 401) {
            const errorData = await response.clone().json().catch(() => ({}));

            if (errorData.error === 'expired_token' || errorData.message === 'Token expired') {
                processLogout('Your session has expired. Please log in again.');
                return response; // Return anyway so caller can handle as needed
            }
        }

        return response;
    } catch (error) {
        console.error('API Client Error:', error);
        throw error;
    }
};

/**
 * Triggers a global logout across the application
 */
const processLogout = (message) => {
    console.warn('Authentication failure: Logging out user.');

    // Clear storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Show message (optional: could use a custom event)
    if (message) {
        alert(message);
    }

    // Redirect to login
    // We use window.location because we are outside the React router context
    // Use HashRouter format #/login
    window.location.href = '#/login';
};

export default apiClient;
