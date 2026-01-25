import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs'; // Ensure we run in Node context to access process.env

async function proxy(req: NextRequest, props: { params: Promise<{ proxy: string[] }> }) {
    const params = await props.params;
    const apiUrl = process.env.API_URL || "http://localhost:7071/api";

    // Construct target URL
    // params.proxy is array ['list_projects']
    const pathStr = params.proxy.join("/");
    const targetUrl = `${apiUrl}/${pathStr}${req.nextUrl.search}`;

    console.log(`[Proxy] Forwarding ${req.nextUrl.pathname} to ${targetUrl}`);

    try {
        const headers = new Headers(req.headers);
        if (process.env.API_KEY) {
            headers.set("x-functions-key", process.env.API_KEY);
        }

        // Forward the request
        const upstreamResponse = await fetch(targetUrl, {
            method: req.method,
            headers: headers,
            body: req.body,
            // @ts-ignore - dupliex is needed for some node fetch implementations with streaming bodies
            duplex: 'half',
        });

        // Forward the response back
        return new NextResponse(upstreamResponse.body, {
            status: upstreamResponse.status,
            statusText: upstreamResponse.statusText,
            headers: upstreamResponse.headers,
        });
    } catch (error) {
        console.error("[Proxy] Error:", error);
        return NextResponse.json({ error: "Proxy failed" }, { status: 502 });
    }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE, proxy as PATCH };
