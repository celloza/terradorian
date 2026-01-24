import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"

export const { handlers, auth, signIn, signOut } = NextAuth(async (req) => {
    const providers = []

    // 1. Owner Credentials Provider
    providers.push(
        Credentials({
            name: "Owner Login",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" }
            },
            authorize: async (credentials) => {
                // In a real app, hash and compare. Here we use env vars or default.
                const validUser = process.env.OWNER_USERNAME || "admin"
                const validPass = process.env.OWNER_PASSWORD || "admin"

                if (credentials.username === validUser && credentials.password === validPass) {
                    return { id: "owner", name: "Owner", email: "owner@local" }
                }
                return null
            }
        })
    )

    // 2. Dynamic Entra ID Provider
    try {
        const apiUrl = process.env.API_URL || "http://localhost:7071/api"
        const res = await fetch(`${apiUrl}/settings/auth`, { cache: 'no-store' })
        if (res.ok) {
            const settings = await res.json()
            if (settings.client_id && settings.client_secret && settings.tenant_id) {
                providers.push(
                    MicrosoftEntraID({
                        clientId: settings.client_id,
                        clientSecret: settings.client_secret,
                        issuer: `https://login.microsoftonline.com/${settings.tenant_id}/v2.0`,
                    })
                )
            }
        }
    } catch (e) {
        console.error("Failed to fetch auth settings", e)
    }

    return {
        providers,
        pages: {
            signIn: '/login',
        },
        callbacks: {
            authorized({ auth, request: { nextUrl } }) {
                const isLoggedIn = !!auth?.user

                // Public Paths
                const isPublic = nextUrl.pathname === '/login' || nextUrl.pathname.startsWith('/api/auth') || nextUrl.pathname.startsWith('/_next') || nextUrl.pathname.startsWith('/static')

                if (isLoggedIn) {
                    // Redirect to dashboard if logged in and on login page
                    if (nextUrl.pathname === '/login') {
                        return Response.redirect(new URL('/', nextUrl))
                    }
                    return true
                }

                if (isPublic) return true

                // Redirect to login for all other pages
                return false
            },
        }
    }
})
