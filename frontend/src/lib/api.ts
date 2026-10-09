import axios from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/v1';

const api = axios.create({
    baseURL,
    withCredentials: true,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
})

// Aynı anda 401 alan istekler tek bir /refresh çağrısını bekler.
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
                    // Oturum çerezleri HttpOnly olduğu için JS'den silinemez; süresi dolmuş ya da geçersiz durumdalar.
                    localStorage.removeItem('is_logged_in');
                    if (!window.location.pathname.startsWith('/login')) {
                        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
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