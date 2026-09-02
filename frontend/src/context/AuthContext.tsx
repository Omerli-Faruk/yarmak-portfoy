'use client';


import React, {createContext, useEffect, useState, useContext} from "react";
import {useRouter} from "next/navigation";
import {AuthResponse, User} from "@/types";
import api from "@/lib/api";


interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({children}: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const router = useRouter();




    useEffect(() => {
        async function checkAuth() {
            const token = localStorage.getItem('token')
            try {
                if (token) {
                    const {data} = await api.get<User>('/me');
                    setUser(data);
                } else{
                    setLoading(false);
                    return;
                }

            } catch (error) {
                setUser(null)
                localStorage.removeItem('token')
                localStorage.removeItem('refresh_token');
                console.log(error);
            } finally {
                setLoading(false);
            }
        }
        void checkAuth();
    }, [])

    const login = async (email: string, password: string) => {
        const {data} = await api.post<AuthResponse>('/login', {email, password});
        localStorage.setItem('token', data.token);
        localStorage.setItem('refresh_token', data.refresh_token);
        setUser(data.user);
        router.push('/');
    }

    const register = async (email: string, password: string) => {
        await api.post<AuthResponse>('/register', {email, password});
        await login(email, password)
    }

    const logOut = async () => {
        const refreshToken = localStorage.getItem('refresh_token');
        try {
            if (refreshToken) { await api.post('/revoke', { refresh_token: refreshToken }); }

        } catch (error) {
            console.log(error)
        }
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        router.push('/login');
    }
    return (
        <AuthContext.Provider value={{user, loading, login, register, logOut}}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth bir AuthProvider içinde kullanılmalıdır.');
    }
    return context
}
