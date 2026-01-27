"use client"

import Link from "next/link"
import { usePathname, useParams, useSearchParams } from "next/navigation"
import useSWR from "swr"
import { fetcher } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Compass, Settings, Activity } from "lucide-react"

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

                    <div className="pt-4 pb-2 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Dashboards
                    </div>

                    {/* Environment Links */}
                    {environments.map((env: string) => {
                        const isEnvActive = pathname.includes("/dashboard") && (currentEnv === env || (!currentEnv && env === 'dev')) // Default to dev if no param, but that logic is in page.
                        // Actually, cleaner to rely on strict param matching if possible, but let's just highlight if param matches.
                        // If no param is present, the dashboard defaults to 'dev', so highlight 'dev'.
                        const isActive = pathname.includes("/dashboard") && (currentEnv === env || (!currentEnv && env === 'dev'))

                        return (
                            <Button
                                key={env}
                                variant="ghost"
                                asChild
                                className={cn(
                                    "w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800",
                                    isActive && "bg-[#2D313A] text-white font-medium hover:bg-[#2D313A]"
                                )}
                            >
                                <Link href={`/p/${projectId}/dashboard?env=${env}`}>
                                    <LayoutDashboard className="mr-3 h-4 w-4" />
                                    {env}
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

                    <Button
                        variant="ghost"
                        asChild
                        className={cn(
                            "w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800",
                            pathname.includes("/graph") && "bg-[#2D313A] text-white font-medium hover:bg-[#2D313A]"
                        )}
                    >
                        <Link href={`/p/${projectId}/graph`}>
                            <Activity className="mr-3 h-4 w-4" /> {/* Reusing Activity or BarChart2/Share2 */}
                            Graph
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
