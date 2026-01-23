"use client"

import Link from "next/link"
import Image from "next/image"
import { TerradorianLogo } from "@/components/terradorian-logo"
import { ProjectSwitcher } from "@/components/project-switcher"
import { EnvironmentSwitcher } from "@/components/environment-switcher"
import { ContextSidebar } from "@/components/context-sidebar"
import { CircleUser, Bell, HelpCircle, LogOut, Settings, User } from "lucide-react"
import { Button } from "@/components/ui/button"
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
    return (
        <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-900">
            {/* Top Bar */}
            <header className="h-14 bg-[#14161A] border-b border-[#1F2125] flex items-center justify-between px-4 shrink-0 z-50">
                <div className="flex items-center gap-6">
                    {/* Logo Area */}
                    <Link href="/" className="flex items-center gap-3 text-white font-bold text-lg hover:opacity-90 transition-opacity">
                        <div className="relative w-8 h-8">
                            <TerradorianLogo />
                        </div>
                        terradorian
                    </Link>

                    {/* Divider */}
                    <div className="h-6 w-px bg-zinc-700" />

                    {/* Context Switcher */}
                    <div className="flex items-center gap-2">
                        <ProjectSwitcher />
                        <span className="text-zinc-600">/</span>
                        <EnvironmentSwitcher />
                    </div>
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
                            <DropdownMenuItem className="text-red-600">
                                <LogOut className="mr-2 h-4 w-4" /> Log out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Main Layout: Sidebar + Content */}
            <div className="flex flex-1 overflow-hidden">
                <aside className="shrink-0 z-40">
                    <ContextSidebar />
                </aside>

                <main className="flex-1 overflow-auto bg-[#F6F7F9] dark:bg-[#0F1115] w-full">
                    <div className="h-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
