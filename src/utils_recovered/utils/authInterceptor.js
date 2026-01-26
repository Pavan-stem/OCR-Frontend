/**
 * Global fetch interceptor for authentication
 * Catches 401 responses and triggers logout if the token is expired.
 */
export const setupAuthInterceptor = () => {
    const { fetch: originalFetch } = window;

    window.fetch = async (...args) => {
        try {
            const response = await originalFetch(...args);

            if (response.status === 401) {
                // Clone response so we can read body without consuming it for the caller
                const clone = response.clone();
                try {
                    const data = await clone.json();
                    if (data.error === 'expired_token' || data.message === 'Token expired') {
                        console.warn('Session expired. Logging out.');

                        // Clear storage
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');

                        // Notify user once
                        if (!window.__is_logging_out) {
                            window.__is_logging_out = true;
                            alert('Your session has expired. Please log in again.');
                            window.location.href = '#/login';

                            // Reset flag after redirect
                            setTimeout(() => { window.__is_logging_out = false; }, 2000);
                        }
                    }
                } catch (e) {
                    // Not JSON or other error
                }
            }
            return response;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    };
};
