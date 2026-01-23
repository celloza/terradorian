"use client"

import Link from "next/link"
import { usePathname, useParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Compass, Settings, ShieldAlert, FileText } from "lucide-react"

export function ContextSidebar() {
    const pathname = usePathname()
    const params = useParams()
    const projectId = params.id as string

    // Helper to check active state
    const isActive = (path: string) => pathname.includes(path)

    return (
        <div className="w-64 bg-[#0F1115] text-white border-r border-[#1F2125] flex flex-col h-full pt-4">
            <div className="px-3 py-2">
                <div className="space-y-1">
                    <Button
                        variant="ghost"
                        asChild
                        className={cn(
                            "w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800",
                            isActive("/dashboard") && "bg-[#2D313A] text-white font-medium hover:bg-[#2D313A]"
                        )}
                    >
                        <Link href={`/p/${projectId}/dashboard`}>
                            <LayoutDashboard className="mr-3 h-4 w-4" />
                            Dashboards
                        </Link>
                    </Button>
                    <Button
                        variant="ghost"
                        asChild
                        className={cn(
                            "w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800",
                            isActive("/explore") && "bg-[#2D313A] text-white font-medium hover:bg-[#2D313A]"
                        )}
                    >
                        <Link href={`/p/${projectId}/explore`}>
                            <Compass className="mr-3 h-4 w-4" />
                            Explore
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="mt-auto px-3 py-4">
                <Button
                    variant="ghost"
                    asChild
                    className={cn(
                        "w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800",
                        isActive("/settings") && "bg-[#2D313A] text-white font-medium hover:bg-[#2D313A]"
                    )}
                >
                    <Link href={`/p/${projectId}/settings`}>
                        <Settings className="mr-3 h-4 w-4" />
                        Settings
                    </Link>
                </Button>
            </div>
        </div>
    )
}
