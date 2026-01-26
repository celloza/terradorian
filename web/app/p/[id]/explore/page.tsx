"use client"

import { useState, useMemo, use, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { fetcher, listPlans } from "@/lib/api"
import { ResourceList, ResourceChange } from "@/components/resource-list"
import { formatDistanceToNow } from "date-fns"
import { Clock, Layers, Box, Filter } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

export default function ExplorePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const searchParams = useSearchParams()
    // Ignore URL env param for fetching, we want ALL to enable client-side filter
    // const env = searchParams.get("env") || "dev" 

    // Group By State: default to 'resource_group'
    const [groupBy, setGroupBy] = useState<"none" | "resource_group" | "type" | "environment">("resource_group")

    // Fetch ALL plans
    const { data: plans } = useSWR(listPlans(id), fetcher)

    // Discover Environments
    const availableEnvs = useMemo(() => {
        if (!plans) return []
        const envs = new Set<string>()
        plans.forEach((p: any) => envs.add(p.environment))
        return Array.from(envs).sort()
    }, [plans])

    // Filter State
    const [visibleEnvs, setVisibleEnvs] = useState<Set<string>>(new Set())

    // Init Visible Envs (Default All)
    useEffect(() => {
        if (availableEnvs.length > 0 && visibleEnvs.size === 0) {
            setVisibleEnvs(new Set(availableEnvs))
        }
    }, [availableEnvs])

    const toggleEnv = (env: string) => {
        const next = new Set(visibleEnvs)
        if (next.has(env)) next.delete(env)
        else next.add(env)
        setVisibleEnvs(next)
    }

    // Data Processing: Aggregate latest plan per component -> Flatten
    const resourceChanges = useMemo(() => {
        if (!plans) return []

        // 1. Group by Environment -> Component -> Latest Plan
        const latestByCompAndEnv: Record<string, any> = {}

        // Plans are ordered by timestamp desc (usually). 
        // We verify sorting or assume order.
        // Iterate and pick first occurrence of comp_id + env combination
        plans.forEach((p: any) => {
            const key = `${p.environment}:${p.component_id}`
            if (!latestByCompAndEnv[key]) {
                latestByCompAndEnv[key] = p
            }
        })

        // 2. Flatten into ResourceChanges
        const flatChanges: ResourceChange[] = []

        Object.values(latestByCompAndEnv).forEach((p: any) => {
            // Apply Env Filter
            if (!visibleEnvs.has(p.environment)) return

            if (p.terraform_plan && p.terraform_plan.resource_changes) {
                p.terraform_plan.resource_changes.forEach((rc: any) => {
                    flatChanges.push({
                        ...rc,
                        environment: p.environment,
                        componentId: p.component_id,
                    })
                })
            }
        })

        return flatChanges
    }, [plans, visibleEnvs])

    // Calc stats
    const totalResources = resourceChanges.length

    return (
        <div className="p-6 h-full flex flex-col space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#14161A]">Explore Resources</h1>
                    <p className="text-muted-foreground">Unified detailed view of your infrastructure.</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Environment Filter */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 border-dashed">
                                <Filter className="mr-2 h-4 w-4" />
                                Environments
                                {visibleEnvs.size < availableEnvs.length && (
                                    <span className="ml-2 rounded-sm bg-primary px-1 font-normal text-primary-foreground text-xs">
                                        {visibleEnvs.size}
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0" align="end">
                            <div className="p-2 space-y-2">
                                <div className="flex items-center space-x-2 pb-2 border-b">
                                    <Label className="text-xs font-semibold">Filter Environments</Label>
                                </div>
                                {availableEnvs.map(env => (
                                    <div key={env} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`filter-${env}`}
                                            checked={visibleEnvs.has(env)}
                                            onCheckedChange={() => toggleEnv(env)}
                                        />
                                        <Label htmlFor={`filter-${env}`} className="text-sm font-normal cursor-pointer w-full">{env}</Label>
                                    </div>
                                ))}
                                {availableEnvs.length === 0 && <div className="text-xs text-muted-foreground">No environments data.</div>}
                            </div>
                        </PopoverContent>
                    </Popover>

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
                <ResourceList changes={resourceChanges} groupBy={groupBy} />
            </div>
        </div>
    )
}
