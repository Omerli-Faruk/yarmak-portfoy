import axios from 'axios';
import { setCookie,removeCookie } from '@/lib/cookies'

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/v1';

const api = axios.create({
    baseURL,
    withCredentials: true,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
})

let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
    response => response,
    async error => {
        if (error.response?.status === 401 && !error.config._retry && typeof window !== 'undefined' && !error.config.url?.includes('/login') && !error.config.url?.includes('/refresh')) {
            error.config._retry = true;

            try {
                if (!refreshPromise) {
                    refreshPromise = (async () => {
                        try {
                            await axios.post(`${baseURL}/refresh`, {}, { withCredentials: true });
                            return "ok";
                        } finally {
                            refreshPromise = null;
                        }
                    })();
                }

                await refreshPromise;
                return api(error.config);

            } catch (refreshErr) {
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('is_logged_in');
                    document.cookie = 'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                    document.cookie = 'refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                    if (!window.location.pathname.startsWith('/login')) {
                        window.location.href = '/login';
                    }
                }
                return Promise.reject(refreshErr);
            }
        }
        return Promise.reject(error);
    }
);

export default api