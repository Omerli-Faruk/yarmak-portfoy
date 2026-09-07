'use client';

import React, {createContext, useEffect, useState, useContext} from "react";
import {useRouter} from "next/navigation";
import {AuthResponse, User} from "@/types";
import api from "@/lib/api";
import Image from "next/image";
import { setCookie,removeCookie } from '@/lib/cookies'


interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (identifier: string, password: string) => Promise<void>;
    register: (email: string, password: string, username: string) => Promise<void>;
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
                } else {
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

    const login = async (identifier: string, password: string) => {
        const {data} = await api.post<AuthResponse>('/login', {email: identifier, password});
        localStorage.setItem('token', data.token);
        setCookie('token', data.token, 7);
        localStorage.setItem('refresh_token', data.refresh_token);
        setUser(data.user);
        router.push('/dashboard')
    }

    const register = async (email: string, password: string, username: string) =>
    {
        await api.post<AuthResponse>('/register', {email, password, username});
        await login(email, password)
    }

    const logOut = async () => {
        const refreshToken = localStorage.getItem('refresh_token');
        try {
            if (refreshToken) {
                await api.post('/revoke', {refresh_token: refreshToken});
            }

        } catch (error) {
            console.log(error)
        }
        localStorage.removeItem('token');
        removeCookie('token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        router.push('/login');
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center">
                <Image src="/logo.png" alt="Yarmak Logo" width={80} height={80} className="size-20 object-contain"/>
                <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
            </div>
        );
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