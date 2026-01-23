import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const apiUrl = process.env.API_URL || "http://localhost:7071/api";

    // request.nextUrl.pathname is e.g. "/api/list_projects"
    // We want to forward to `${apiUrl}/list_projects`
    // Since apiUrl ends in /api (set in bicep), and pathname starts with /api, 
    // we need to strip one /api or handle the join correctly.

    // Strip '/api' prefix from the pathname
    const path = request.nextUrl.pathname.replace(/^\/api/, '');

    // Construct the target URL
    // apiUrl: https://func.../api
    // path: /list_projects
    // Result: https://func.../api/list_projects
    const targetUrl = new URL(path, apiUrl);

    // Forward query parameters
    targetUrl.search = request.nextUrl.search;

    return NextResponse.rewrite(targetUrl);
}

export const config = {
    matcher: '/api/:path*',
}
