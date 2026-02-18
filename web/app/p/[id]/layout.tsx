"use client"

import Link from "next/link"
import Image from "next/image"
import { TerradorianLogo } from "@/components/terradorian-logo"
import { ProjectSwitcher } from "@/components/project-switcher"
import { EnvironmentSwitcher } from "@/components/environment-switcher"
import { ContextSidebar } from "@/components/context-sidebar"
import { TopNavBar } from "@/components/top-nav-bar"
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

export default function ProjectContextLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const handleLogout = async () => {
        try {
            await signOut({ redirect: true, callbackUrl: "/login" })
        } catch (e) {
            console.error("Logout failed:", e)
            window.location.href = "/login"
        }
    }

    return (
        <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
            {/* Top Bar */}
            <TopNavBar>
                <div className="flex items-center gap-2">
                    <ProjectSwitcher />
                </div>
            </TopNavBar>

            {/* Main Layout: Sidebar + Content */}
            <div className="flex flex-1 overflow-hidden h-full">
                <aside className="shrink-0 z-40 h-full overflow-y-auto overflow-x-hidden border-r bg-background">
                    <ContextSidebar />
                </aside>

                <main className="flex-1 h-full overflow-y-auto bg-[#F6F7F9] dark:bg-[#0F1115] w-full">
                    <div className="min-h-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
