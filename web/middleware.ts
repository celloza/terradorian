import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from "next-auth/jwt"

type AuthMode = 'nextauth' | 'easyauth'

let cachedAuthMode: AuthMode = 'nextauth'
let cachedAt = 0

async function getAuthMode(): Promise<AuthMode> {
    const now = Date.now()
    if (now - cachedAt < 60_000) {
        return cachedAuthMode
    }

    try {
        const apiUrl = process.env.API_URL || "http://localhost:7071/api"
        const res = await fetch(`${apiUrl}/settings/auth`, { cache: 'no-store' })
        if (res.ok) {
            const settings = await res.json()
            cachedAuthMode = settings.auth_mode === 'easyauth' ? 'easyauth' : 'nextauth'
            cachedAt = now
        }
    } catch (e) {
        // Keep previous mode on transient failures.
    }

    return cachedAuthMode
}

export async function middleware(req: NextRequest) {
    const authMode = await getAuthMode()

    // 1. Auth Check using JWT Token
    // We use getToken because the 'auth' wrapper from v5 beta was causing runtime type errors with async config.
    // Explicitly check for the legacy cookie name we forced in auth.ts
    // Debug: Log environment status
    if (!process.env.AUTH_SECRET) console.error("MIDDLEWARE ERROR: AUTH_SECRET is missing!");
    if (!process.env.NEXTAUTH_SECRET) console.error("MIDDLEWARE WARNING: NEXTAUTH_SECRET is missing!");

    let token = null;
    try {
        token = await getToken({
            req,
            secret: process.env.AUTH_SECRET, // Fallback to NEXTAUTH_SECRET happens internally usually?
            cookieName: 'next-auth.session-token'
        })
    } catch (e) {
        console.error("MIDDLEWARE: getToken failed:", e);
        // Treat as not logged in, don't crash the app
    }

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
    const isEasyAuthPath = pathname.startsWith('/.auth')

    // Allow public assets and auth API
    if (isApiAuth || isPublicStatic || isHealth || isEasyAuthPath) {
        return NextResponse.next()
    }

    if (authMode === 'easyauth') {
        const easyAuthPrincipal = req.headers.get('x-ms-client-principal')
        const easyAuthPrincipalId = req.headers.get('x-ms-client-principal-id')
        const isEasyAuthLoggedIn = !!easyAuthPrincipal || !!easyAuthPrincipalId

        if (!isEasyAuthLoggedIn && !isPublicApi) {
            const postLogin = encodeURIComponent(req.nextUrl.href)
            return NextResponse.redirect(new URL(`/.auth/login/aad?post_login_redirect_uri=${postLogin}`, req.url))
        }

        if (isLogin && isEasyAuthLoggedIn) {
            return NextResponse.redirect(new URL('/', req.url))
        }

        return NextResponse.next()
    }

    // Login Page Redirection
    if (isLogin) {
        if (isLoggedIn) {
            const baseUrl = process.env.NEXTAUTH_URL || req.url
            return NextResponse.redirect(new URL('/', baseUrl))
        }
        // Allow access to login page
        return NextResponse.next()
    }

    // Protected Routes (Everything else)
    if (!isLoggedIn && !isPublicApi) {
        // Fix: Use NEXTAUTH_URL if available to prevent leaking internal container hostname
        // NEXTAUTH_URL should be "https://web-terradorian-dev.azurewebsites.net"
        const baseUrl = process.env.NEXTAUTH_URL || req.url
        const loginUrl = new URL('/login', baseUrl)

        // Ensure the callback URL is also properly rooted
        const callbackUrl = new URL(req.nextUrl.pathname + req.nextUrl.search, baseUrl).toString()
        loginUrl.searchParams.set('callbackUrl', callbackUrl)

        return NextResponse.redirect(loginUrl)
    }

    // 2. API Protection
    // Note: We DO NOT rewrite here. We let the request fall through to 
    // app/api/[...proxy]/route.ts which handles the proxying and Secret Injection.
    // The middleware only ensures the user is authenticated.

    return NextResponse.next()
}

// Matcher must include api routes for rewrite, and other routes for protection
export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
