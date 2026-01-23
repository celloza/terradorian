"use client"

import { useState, useMemo, use } from "react"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { fetcher, listPlans } from "@/lib/api"
import { ResourceList } from "@/components/resource-list"
import { formatDistanceToNow } from "date-fns"
import { Clock, Layers, Box } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

export default function ExplorePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const searchParams = useSearchParams()
    const env = searchParams.get("env") || "dev"

    // Group By State: default to 'resource_group'
    const [groupBy, setGroupBy] = useState<"none" | "resource_group" | "type" | "environment">("resource_group")

    // If grouping by environment, fetch ALL plans (no filter). Otherwise respect env filter.
    const swrKey = groupBy === "environment" ? listPlans(id) : listPlans(id, env)
    const { data: plans } = useSWR(swrKey, fetcher)

    // Data Processing
    // 1. Single View (Default)
    const latestPlan = plans && plans.length > 0 ? plans[0] : null

    // 2. Multi-Env View
    const envPlans = useMemo(() => {
        if (!plans || groupBy !== "environment") return {}
        const latestByEnv: Record<string, any> = {}
        // Plans are ordered by timestamp desc, so first one we see for an env is the latest
        plans.forEach((p: any) => {
            if (!latestByEnv[p.environment]) {
                latestByEnv[p.environment] = p
            }
        })
        return latestByEnv
    }, [plans, groupBy])

    const envs = Object.keys(envPlans).sort()
    const timeAgo = latestPlan ? formatDistanceToNow(new Date(latestPlan.timestamp), { addSuffix: true }) : null

    return (
        <div className="p-6 h-full flex flex-col space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#14161A]">Explore Resources</h1>
                    <p className="text-muted-foreground">Detailed view of your infrastructure state and drift.</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Info Badge (only meaningful in single view) */}
                    {groupBy !== "environment" && timeAgo && (
                        <div className="hidden md:flex items-center text-xs text-muted-foreground bg-white px-3 py-1.5 rounded-full border shadow-sm">
                            <Clock className="w-3.5 h-3.5 mr-2" />
                            State from {timeAgo}
                        </div>
                    )}

                    {/* Group By Control */}
                    <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Group by:</Label>
                        <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                            <SelectTrigger className="w-[160px] h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="resource_group">Resource Group</SelectItem>
                                <SelectItem value="environment">Environment</SelectItem>
                                <SelectItem value="type">Resource Type</SelectItem>
                                <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-lg border shadow-sm p-6 overflow-auto">
                {/* CASE 1: Group By Environment */}
                {groupBy === "environment" && (
                    <div className="space-y-8">
                        {envs.length === 0 && <div className="text-center text-muted-foreground">No environments found.</div>}
                        {envs.map(envName => (
                            <div key={envName} className="space-y-4">
                                <h2 className="text-lg font-bold flex items-center gap-2 pb-2 border-b">
                                    <Box className="h-5 w-5 text-blue-500" />
                                    {envName}
                                    <span className="text-xs font-normal text-muted-foreground bg-zinc-100 px-2 py-0.5 rounded-full ml-2">
                                        {formatDistanceToNow(new Date(envPlans[envName].timestamp), { addSuffix: true })}
                                    </span>
                                </h2>
                                <ResourceList plan={envPlans[envName]} groupBy="none" />
                            </div>
                        ))}
                    </div>
                )}

                {/* CASE 2: Single Env View (grouped by RG, Type, or None) */}
                {groupBy !== "environment" && (
                    latestPlan ? (
                        <ResourceList plan={latestPlan} groupBy={groupBy} />
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            {plans ? "No plan data available." : "Loading..."}
                        </div>
                    )
                )}
            </div>
        </div>
    )
}
