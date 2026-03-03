"use client"

import Link from "next/link"
import { usePathname, useParams, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import useSWR from "swr"
import { fetcher } from "@/lib/api"
import { cn, groupEnvironments } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Compass, Settings, Activity, ChevronRight, ChevronDown } from "lucide-react"
import packageJson from "../package.json"

export function ContextSidebar() {
    const pathname = usePathname()
    const params = useParams()
    const searchParams = useSearchParams()
    const projectId = params.id as string
    const currentEnv = searchParams.get("env")
    const currentGroup = searchParams.get("group")
    const currentRegion = searchParams.get("region")

    const [expanded, setExpanded] = useState<Record<string, boolean>>({})

    useEffect(() => {
        if (currentGroup) {
            setExpanded(prev => {
                const newState = { ...prev, [currentGroup as string]: true };
                if (currentRegion) {
                    newState[`${currentGroup}-${currentRegion}`] = true;
                }
                return newState;
            })
        }
    }, [currentGroup, currentRegion])

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
    }

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




                    {/* Environment Groups */}
                    {Object.entries(groupEnvironments(environments, project?.environments_config)).map(([group, regions]) => {
                        const isGroupExpanded = expanded[group]
                        const isGroupActive = currentGroup === group && !currentRegion && !currentEnv && (pathname.includes("/dashboard") || pathname.includes("/graph"))

                        return (
                            <div key={group} className="mb-2">
                                <Button
                                    variant="ghost"
                                    asChild
                                    className={cn(
                                        "w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800 pl-2 pr-4 h-8 text-xs font-semibold uppercase tracking-wider mb-1",
                                        isGroupActive && "bg-[#2D313A] text-white hover:bg-[#2D313A]"
                                    )}
                                >
                                    <Link href={`/p/${projectId}/dashboard?group=${encodeURIComponent(group)}`}>
                                        <div
                                            onClick={(e) => toggleExpand(group, e)}
                                            className="mr-1 p-0.5 hover:bg-zinc-600 rounded cursor-pointer"
                                        >
                                            {isGroupExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                        </div>
                                        {group}
                                    </Link>
                                </Button>

                                {isGroupExpanded && Object.entries(regions).map(([region, envs]) => {
                                    const regionKey = `${group}-${region}`
                                    const isRegionExpanded = expanded[regionKey]
                                    const isRegionActive = currentGroup === group && currentRegion === region && !currentEnv && (pathname.includes("/dashboard") || pathname.includes("/graph"))

                                    return (
                                        <div key={region} className="mb-1">
                                            <Button
                                                variant="ghost"
                                                asChild
                                                className={cn(
                                                    "w-full justify-start text-zinc-500 hover:text-white hover:bg-zinc-800 pl-6 pr-4 h-7 text-[10px] font-medium uppercase tracking-wider mb-0.5",
                                                    isRegionActive && "bg-[#2D313A] text-white hover:bg-[#2D313A]"
                                                )}
                                            >
                                                <Link href={`/p/${projectId}/dashboard?group=${encodeURIComponent(group)}&region=${encodeURIComponent(region)}`}>
                                                    <div
                                                        onClick={(e) => toggleExpand(regionKey, e)}
                                                        className="mr-2 p-0.5 hover:bg-zinc-600 rounded cursor-pointer"
                                                    >
                                                        {isRegionExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                                    </div>
                                                    {region}
                                                </Link>
                                            </Button>

                                            {isRegionExpanded && envs.map((env: string) => {
                                                const isEnvActive = (pathname.includes("/dashboard") || pathname.includes("/graph")) && currentEnv === env

                                                return (
                                                    <Button
                                                        key={env}
                                                        variant="ghost"
                                                        asChild
                                                        className={cn(
                                                            "w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800 pl-[42px] h-8 text-sm", // concise
                                                            isEnvActive && "bg-[#2D313A] text-white font-medium hover:bg-[#2D313A]"
                                                        )}
                                                    >
                                                        <Link href={`/p/${projectId}/dashboard?env=${encodeURIComponent(env)}`}>
                                                            <LayoutDashboard className="mr-3 h-3.5 w-3.5" />
                                                            {env}
                                                        </Link>
                                                    </Button>
                                                )
                                            })}
                                        </div>
                                    )
                                })}
                            </div>
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
