import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/dashboard', '/holdings', '/transactions', '/alerts'];
const authRoutes = ['/', '/login', '/register'];

export function proxy(request: NextRequest) {
    const reqUrl = request.nextUrl.pathname;
    const token = request.cookies.get('access_token')?.value;

    const isProtectedRoute = protectedRoutes.some(route => reqUrl.startsWith(route));
    const isAuthRoute = authRoutes.includes(reqUrl);

    if (isProtectedRoute && !token) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isAuthRoute && token) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/',
        '/login',
        '/register',
        '/dashboard/:path*',
        '/holdings/:path*',
        '/transactions/:path*',
        '/alerts/:path*',
    ],
};