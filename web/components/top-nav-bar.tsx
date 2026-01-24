"use client"

import Link from "next/link"
import { TerradorianLogo } from "@/components/terradorian-logo"
import { CircleUser, Bell, HelpCircle, LogOut, Settings, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOut } from "next-auth/react"
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

export function TopNavBar({ children }: TopNavBarProps) {
    const handleLogout = async () => {
        try {
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <User className="mr-2 h-4 w-4" /> Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <Settings className="mr-2 h-4 w-4" /> Settings
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
