import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/dashboard', '/holdings', '/transactions', '/alerts', '/profile'];

export function proxy(request: NextRequest) {
    const reqUrl = request.nextUrl.pathname;
    const token = request.cookies.get('access_token')?.value;
    const refreshToken = request.cookies.get('refresh_token')?.value;

    const isProtectedRoute = protectedRoutes.some(route => reqUrl.startsWith(route));

    // Korumalı bir sayfaya erişmeye çalışıyor ve hiçbir çerez (ne access ne refresh) yoksa login sayfasına yönlendir
    if (isProtectedRoute && !token && !refreshToken) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/holdings/:path*',
        '/transactions/:path*',
        '/alerts/:path*',
        '/profile/:path*',
    ],
};
