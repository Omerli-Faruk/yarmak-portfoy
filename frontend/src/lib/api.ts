import axios from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/v1';

const api = axios.create({
    baseURL,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
})

api.interceptors.request.use(
    (config) => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    response => response,
    async error => {
        if (error.response?.status === 401 && !error.config._retry && typeof window !== 'undefined'){
            error.config._retry = true;
            const refreshToken = localStorage.getItem('refresh_token');
            if (!refreshToken) {
                localStorage.removeItem('token');
                localStorage.removeItem('refresh_token');
                window.location.href = '/login';
                return Promise.reject(error);
            }
            try {
                const { data } = await axios.post(`${baseURL}/refresh`, {
                    refresh_token: refreshToken,
                });
                localStorage.setItem('token', data.token);
                localStorage.setItem('refresh_token', data.refresh_token);

                error.config.headers.Authorization = `Bearer ${data.token}`;
                return api(error.config);
            } catch (refreshErr) {
                localStorage.removeItem('token');
                localStorage.removeItem('refresh_token');
                window.location.href = '/login';
                return Promise.reject(refreshErr);
            }
        }
        return Promise.reject(error);
    }
)

export default api