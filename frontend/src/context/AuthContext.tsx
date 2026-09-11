'use client';

import React, {createContext, useEffect, useState, useContext} from "react";
import {useRouter} from "next/navigation";
import {AuthResponse, User} from "@/types";
import api from "@/lib/api";
import Image from "next/image";
import { setCookie,removeCookie } from '@/lib/cookies'
import LoadingSpinner from "@/components/ui/LoadingSpinner";


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
            const isLoggedIn = localStorage.getItem('is_logged_in');

            if (isLoggedIn === 'true') {
                try {
                    const {data} = await api.get<User>('/me');
                    setUser(data);
                } catch (error) {
                    setUser(null);
                    localStorage.removeItem('is_logged_in');
                    console.log(error);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        }
        void checkAuth();
    }, [])

    const login = async (identifier: string, password: string) => {
        const {data} = await api.post<AuthResponse>('/login', {email: identifier, password});
        localStorage.setItem('is_logged_in', 'true');
        setUser(data.user);
        router.push('/dashboard')
    }

    const register = async (email: string, password: string, username: string) =>
    {
        await api.post<AuthResponse>('/register', {email, password, username});
        await login(email, password)
    }
    const logOut = async () => {
        try {
            await api.post('/revoke');
        } catch (error) {
            console.log(error)
        }
        localStorage.removeItem('is_logged_in');
        setUser(null);
        router.push('/login');
    }

    if (loading) {
        return <LoadingSpinner withLogo />;
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