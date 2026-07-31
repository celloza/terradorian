"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { TerradorianLogo } from "@/components/terradorian-logo"
import { CircleUser, Bell, HelpCircle, LogOut, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOut } from "next-auth/react"
import { useSession } from "next-auth/react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface TopNavBarProps {
    children?: React.ReactNode // Slot for Context Switcher or other content
}

type AuthMode = 'nextauth' | 'easyauth'

type EasyAuthClaim = {
    typ: string
    val: string
}

type EasyAuthMePrincipal = {
    userDetails?: string
    userId?: string
    identityProvider?: string
    claims?: EasyAuthClaim[]
}

type EasyAuthMeResponse = {
    clientPrincipal?: EasyAuthMePrincipal
}

export function TopNavBar({ children }: TopNavBarProps) {
    const { data: session } = useSession()
    const [authMode, setAuthMode] = useState<AuthMode>('nextauth')
    const [easyAuthPrincipal, setEasyAuthPrincipal] = useState<EasyAuthMePrincipal | null>(null)

    useEffect(() => {
        fetch('/api/settings/auth/public', { cache: 'no-store' })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                const mode = data?.auth_mode === 'easyauth' ? 'easyauth' : 'nextauth'
                setAuthMode(mode)

                if (mode === 'easyauth') {
                    fetch('/.auth/me', { cache: 'no-store' })
                        .then((res) => (res.ok ? res.json() : []))
                        .then((payload: EasyAuthMeResponse[]) => {
                            const principal = payload?.[0]?.clientPrincipal || null
                            setEasyAuthPrincipal(principal)
                        })
                        .catch(() => setEasyAuthPrincipal(null))
                }
            })
            .catch(() => setAuthMode('nextauth'))
    }, [])

    const easyAuthEmail = useMemo(() => {
        const claims = easyAuthPrincipal?.claims || []
        return (
            claims.find((c) => c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress')?.val ||
            claims.find((c) => c.typ === 'preferred_username')?.val ||
            claims.find((c) => c.typ === 'upn')?.val ||
            null
        )
    }, [easyAuthPrincipal])

    const displayName = authMode === 'easyauth'
        ? (easyAuthPrincipal?.userDetails || 'Microsoft Entra user')
        : (session?.user?.name || 'User')

    const secondaryValue = authMode === 'easyauth'
        ? (easyAuthEmail || easyAuthPrincipal?.identityProvider || 'aad')
        : (session?.user?.email || 'Owner account')

    const handleLogout = async () => {
        try {
            if (authMode === 'easyauth') {
                const redirect = encodeURIComponent(`${window.location.origin}/login`)
                window.location.href = `/.auth/logout?post_logout_redirect_uri=${redirect}`
                return
            }

            await signOut({ redirect: true, callbackUrl: "/login" })
        } catch (e) {
            console.error("Logout failed:", e)
            window.location.href = "/login"
        }
    }

    return (
        <header className="h-14 bg-[#14161A] border-b border-[#1F2125] flex items-center justify-between px-4 shrink-0 z-50 w-full">
            <div className="flex items-center gap-6">
                {/* Logo Area */}
                {/* Logo Area */}
                <Link href="/" className="flex items-center gap-3 text-white font-bold text-lg hover:opacity-90 transition-opacity">
                    <div className="relative w-8 h-8 flex-shrink-0">
                        <TerradorianLogo />
                    </div>
                    terradorian
                </Link>

                {/* Divider (Only if children exist) */}
                {children && <div className="h-6 w-px bg-zinc-700" />}

                {/* Center Content (Context Switcher) */}
                {children && (
                    <div className="flex items-center gap-2">
                        {children}
                    </div>
                )}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-zinc-800">
                    <HelpCircle className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-zinc-800">
                    <Bell className="h-5 w-5" />
                </Button>
                <div className="h-6 w-px bg-zinc-700 mx-2" />

                {/* Profile Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full">
                            <CircleUser className="h-6 w-6" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                        <div className="px-2 py-2 text-xs text-zinc-500">
                            <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{displayName}</div>
                            <div className="truncate">{secondaryValue}</div>
                            <div className="uppercase tracking-wide mt-1">{authMode}</div>
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/admin/settings" className="cursor-pointer">
                                <Settings className="mr-2 h-4 w-4" /> Settings
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600 cursor-pointer" onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" /> Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}
