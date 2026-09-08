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
        if (error.response?.status === 401 && !error.config._retry && typeof window !== 'undefined' && !error.config.url?.includes('/login')) {
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
                window.location.href = '/login';
                return Promise.reject(refreshErr);
            }
        }
        return Promise.reject(error);
    }
);

export default api