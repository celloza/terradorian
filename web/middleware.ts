import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from "next-auth/jwt"

export async function middleware(req: NextRequest) {
    // 1. Auth Check using JWT Token
    // We use getToken because the 'auth' wrapper from v5 beta was causing runtime type errors with async config.
    const token = await getToken({ req, secret: process.env.AUTH_SECRET })
    const isLoggedIn = !!token

    const { pathname } = req.nextUrl

    // Definitions
    const isApiAuth = pathname.startsWith('/api/auth')
    const isPublicStatic = pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname === '/favicon.ico' ||
        /\.(svg|png|jpg|jpeg|gif|webp)$/i.test(pathname)
    const isLogin = pathname === '/login'
    const isPublicApi = pathname === '/api/settings/auth'
    const isHealth = pathname === '/health'

    // Allow public assets and auth API
    if (isApiAuth || isPublicStatic || isHealth) {
        return NextResponse.next()
    }

    // Login Page Redirection
    if (isLogin) {
        if (isLoggedIn) {
            return NextResponse.redirect(new URL('/', req.url))
        }
        // Allow access to login page
        return NextResponse.next()
    }

    // Protected Routes (Everything else)
    if (!isLoggedIn && !isPublicApi) {
        const loginUrl = new URL('/login', req.url)
        loginUrl.searchParams.set('callbackUrl', req.url)
        return NextResponse.redirect(loginUrl)
    }

    // 2. API Rewrite Logic (Authenticated Users Only for /api/* except auth)
    // (Or public API? Assuming API needs auth too, which is enforced above)
    if (pathname.startsWith('/api')) {
        // Skip auth/nextauth routes from rewriting to backend (handled above/redundant check safe)
        if (pathname.startsWith('/api/auth')) {
            return NextResponse.next()
        }

        const apiUrl = process.env.API_URL || "http://localhost:7071/api";
        const path = pathname.replace(/^\/api/, '');
        const baseUrl = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;

        const targetUrl = new URL(cleanPath, baseUrl);
        targetUrl.search = req.nextUrl.search;

        return NextResponse.rewrite(targetUrl);
    }

    return NextResponse.next()
}

// Matcher must include api routes for rewrite, and other routes for protection
export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
