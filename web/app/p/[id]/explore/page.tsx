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

    // Data Processing: Aggregate latest plan per component
    const aggregatedPlan = useMemo(() => {
        if (!plans) return null

        // 1. Group by Environment (if applicable) or globally if env filter is set
        // Actually, listPlans(id, env) already filters by env if env is set in URL.
        // If groupBy === "environment", we might have multiple envs.

        let targetPlans: any[] = []

        if (groupBy === "environment") {
            // If grouping by environment, we want to show each environment separately.
            // The Aggregation happens *inside* the environment loop in the Render section.
            return null // We handle this in the render loop logic
        } else {
            // For Single Env View (default or filtered)
            // Filter plans to only those matching current env (if set via searchParams, effectively handled by API but let's be safe)
            const currentEnvPlans = plans // .filter(p => p.environment === env) // API handles this

            // 2. Group by Component ID -> Latest Plan
            const latestByComp: Record<string, any> = {}
            currentEnvPlans.forEach((p: any) => {
                if (!latestByComp[p.component_id]) {
                    latestByComp[p.component_id] = p
                }
            })

            // 3. Merge Resource Changes
            const mergedChanges: any[] = []
            Object.values(latestByComp).forEach((p: any) => {
                if (p.terraform_plan && p.terraform_plan.resource_changes) {
                    // Add component name context to address or separate column? 
                    // ResourceList doesn't support component column yet, but address is unique string.
                    // We just merge.
                    mergedChanges.push(...p.terraform_plan.resource_changes)
                }
            })

            // 4. Construct Synthetic Plan
            // Use timestamp from the absolute latest plan for "State from..."
            const latestTimestamp = plans.length > 0 ? plans[0].timestamp : new Date().toISOString()

            return {
                timestamp: latestTimestamp,
                terraform_plan: {
                    resource_changes: mergedChanges
                }
            }
        }
    }, [plans, groupBy, env])

    // 2. Multi-Env View Helper
    const envAggregated = useMemo(() => {
        if (!plans || groupBy !== "environment") return {}

        // Group by Env -> Component -> Latest Plan
        const envs: Record<string, Record<string, any>> = {}

        plans.forEach((p: any) => {
            if (!envs[p.environment]) envs[p.environment] = {}
            if (!envs[p.environment][p.component_id]) {
                envs[p.environment][p.component_id] = p
            }
        })

        // Aggregate per Env
        const result: Record<string, any> = {}
        Object.keys(envs).forEach(envKey => {
            const compPlans = Object.values(envs[envKey])
            const mergedChanges: any[] = []
            let latestTs = ""

            compPlans.forEach((p: any) => {
                if (p.timestamp > latestTs) latestTs = p.timestamp
                if (p.terraform_plan && p.terraform_plan.resource_changes) {
                    mergedChanges.push(...p.terraform_plan.resource_changes)
                }
            })

            result[envKey] = {
                timestamp: latestTs,
                terraform_plan: {
                    resource_changes: mergedChanges
                }
            }
        })
        return result
    }, [plans, groupBy])

    const envs = Object.keys(envAggregated).sort()
    const timeAgo = aggregatedPlan ? formatDistanceToNow(new Date(aggregatedPlan.timestamp), { addSuffix: true }) : null

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
                                        {formatDistanceToNow(new Date(envAggregated[envName].timestamp), { addSuffix: true })}
                                    </span>
                                </h2>
                                <ResourceList plan={envAggregated[envName]} groupBy="none" />
                            </div>
                        ))}
                    </div>
                )}

                {/* CASE 2: Single Env View (grouped by RG, Type, or None) */}
                {groupBy !== "environment" && (
                    aggregatedPlan ? (
                        <ResourceList plan={aggregatedPlan} groupBy={groupBy} />
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
