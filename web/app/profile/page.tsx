import { TopNavBar } from "@/components/top-nav-bar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/auth"
import { headers } from "next/headers"

type AuthMode = 'nextauth' | 'easyauth'

type EasyAuthClaim = {
  typ: string
  val: string
}

type EasyAuthPrincipal = {
  auth_typ?: string
  claims?: EasyAuthClaim[]
  name_typ?: string
  role_typ?: string
  userId?: string
  userDetails?: string
  identityProvider?: string
}

type AuthSettingsPublic = {
  auth_mode?: AuthMode
}

async function getAuthMode(): Promise<AuthMode> {
  try {
    const apiUrl = process.env.API_URL || "http://localhost:7071/api"
    const res = await fetch(`${apiUrl}/settings/auth/public`, { cache: 'no-store' })
    if (!res.ok) {
      return 'nextauth'
    }

    const settings = (await res.json()) as AuthSettingsPublic
    return settings.auth_mode === 'easyauth' ? 'easyauth' : 'nextauth'
  } catch {
    return 'nextauth'
  }
}

async function getEasyAuthPrincipal(): Promise<EasyAuthPrincipal | null> {
  const h = await headers()
  const encodedPrincipal = h.get('x-ms-client-principal')

  if (encodedPrincipal) {
    try {
      const json = Buffer.from(encodedPrincipal, 'base64').toString('utf-8')
      return JSON.parse(json) as EasyAuthPrincipal
    } catch {
      // Fall through to minimal details extracted from individual headers.
    }
  }

  const principalId = h.get('x-ms-client-principal-id')
  const principalName = h.get('x-ms-client-principal-name')
  const idp = h.get('x-ms-client-principal-idp')

  if (!principalId && !principalName && !idp) {
    return null
  }

  return {
    userId: principalId || undefined,
    userDetails: principalName || undefined,
    identityProvider: idp || undefined,
    claims: []
  }
}

function findClaim(principal: EasyAuthPrincipal | null, claimType: string): string | null {
  const value = principal?.claims?.find((c) => c.typ === claimType)?.val
  return value || null
}

export default async function ProfilePage() {
  const authMode = await getAuthMode()

  if (authMode === 'easyauth') {
    const principal = await getEasyAuthPrincipal()
    const displayName = principal?.userDetails || findClaim(principal, 'name') || 'Unknown user'
    const email = findClaim(principal, 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress')
      || findClaim(principal, 'preferred_username')
      || findClaim(principal, 'upn')

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
        <TopNavBar />

        <div className="flex-1 container max-w-4xl mx-auto py-10 px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Profile</h1>
            <p className="text-zinc-500 dark:text-zinc-400">Signed in via Azure App Service EasyAuth.</p>
          </div>

          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <CardHeader>
              <CardTitle>Microsoft Entra User</CardTitle>
              <CardDescription>Identity details from EasyAuth request headers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2">
                <span className="text-zinc-500">Display Name</span>
                <span className="font-medium break-all">{displayName}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2">
                <span className="text-zinc-500">Email / UPN</span>
                <span className="font-medium break-all">{email || 'Not available'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2">
                <span className="text-zinc-500">User ID</span>
                <span className="font-medium break-all">{principal?.userId || 'Not available'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2">
                <span className="text-zinc-500">Identity Provider</span>
                <span className="font-medium break-all">{principal?.identityProvider || 'aad'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const session = await auth()

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <TopNavBar />

      <div className="flex-1 container max-w-4xl mx-auto py-10 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Profile</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Signed in via NextAuth.</p>
        </div>

        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <CardHeader>
            <CardTitle>NextAuth User</CardTitle>
            <CardDescription>Identity details from the current NextAuth session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2">
              <span className="text-zinc-500">Username</span>
              <span className="font-medium break-all">{session?.user?.name || 'Unknown user'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2">
              <span className="text-zinc-500">Email</span>
              <span className="font-medium break-all">{session?.user?.email || 'Not available'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2">
              <span className="text-zinc-500">Authentication</span>
              <span className="font-medium break-all">nextauth</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
