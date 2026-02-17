"use client"

import Link from "next/link"
import { usePathname, useParams, useSearchParams } from "next/navigation"
import useSWR from "swr"
import { fetcher } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Compass, Settings, Activity } from "lucide-react"
import packageJson from "../package.json"

export function ContextSidebar() {
    const pathname = usePathname()
    const params = useParams()
    const searchParams = useSearchParams()
    const projectId = params.id as string
    const currentEnv = searchParams.get("env")

    const { data: projects } = useSWR("/list_projects", fetcher)
    const project = projects?.find((p: any) => p.id === projectId)
    const environments = project?.environments || ["dev"]

    // Helper to check active state
    // Exact match for overview, includes for others generally, but specific check for env dashboard
    const isOverview = pathname === `/p/${projectId}/overview`
    const isSettings = pathname.includes("/settings")
    const isExplore = pathname.includes("/explore")

    return (
        <div className="w-64 bg-[#0F1115] text-white border-r border-[#1F2125] flex flex-col h-full pt-4">
            <div className="px-3 py-2">
                <div className="space-y-1">
                    {/* Project Overview */}
                    <Button
                        variant="ghost"
                        asChild
                        className={cn(
                            "w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800",
                            isOverview && "bg-[#2D313A] text-white font-medium hover:bg-[#2D313A]"
                        )}
                    >
                        <Link href={`/p/${projectId}/overview`}>
                            <Activity className="mr-3 h-4 w-4" />
                            Overview
                        </Link>
                    </Button>



                    {/* Environments Header */}
                    <div className="pt-4 pb-2 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Environments
                    </div>

                    {/* Environment Links - Flattened */}
                    {environments.map((env: string) => {
                        // Check if active: either dashboard or graph for this env
                        const currentEnvParam = searchParams.get("env") || "dev"
                        const isEnvActive = (pathname.includes("/dashboard") || pathname.includes("/graph")) && currentEnvParam === env

                        return (
                            <Button
                                key={env}
                                variant="ghost"
                                asChild
                                className={cn(
                                    "w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800",
                                    isEnvActive && "bg-[#2D313A] text-white font-medium hover:bg-[#2D313A]"
                                )}
                            >
                                <Link href={`/p/${projectId}/dashboard?env=${env}`}>
                                    <LayoutDashboard className="mr-3 h-4 w-4" />
                                    {env.charAt(0).toUpperCase() + env.slice(1)}
                                </Link>
                            </Button>
                        )
                    })}

                    <div className="pt-4 pb-2 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Tools
                    </div>

                    <Button
                        variant="ghost"
                        asChild
                        className={cn(
                            "w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800",
                            isExplore && "bg-[#2D313A] text-white font-medium hover:bg-[#2D313A]"
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
                <div className="px-4 pb-2 text-xs text-zinc-500 font-mono">
                    v{packageJson.version}
                </div>
                <Button
                    variant="ghost"
                    asChild
                    className={cn(
                        "w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800",
                        isSettings && "bg-[#2D313A] text-white font-medium hover:bg-[#2D313A]"
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
