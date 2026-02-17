"use client"

import { use } from "react"
import Link from "next/link"
import useSWR from "swr"
import { fetcher, listPlans, listComponents, updateComponent, updateProjectSettings } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Activity, CheckCircle2, AlertTriangle, HelpCircle, ArrowRight, Ban, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { DashboardActionMenu } from "@/components/dashboard-action-menu"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Helper to group environments
// Returns: { "Production": { "UK South": ["production-uks-1", ...], "Global": ["production-global"] } }
const groupEnvironments = (envs: string[], config: Record<string, { group: string, region: string }> | undefined) => {
    const grouped: Record<string, Record<string, string[]>> = {}

    envs.forEach(env => {
        const conf = config?.[env] || { group: "Ungrouped", region: "Global" }
        const group = conf.group || "Ungrouped"
        const region = conf.region || "Global" // Default to 'Global' if region is empty

        if (!grouped[group]) grouped[group] = {}
        if (!grouped[group][region]) grouped[group][region] = []

        grouped[group][region].push(env)
    })

    return grouped
}

export default function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = use(params)

    // Data Fetching
    const { data: project, mutate: mutateProjects } = useSWR("/list_projects", fetcher)
    const { data: components, mutate: mutateComponents } = useSWR(() => `/list_components?project_id=${projectId}`, fetcher)
    const { data: plans, mutate } = useSWR(() => `/list_plans?project_id=${projectId}`, fetcher)

    const activeProject = project?.find((p: any) => p.id === projectId)
    const environments = activeProject?.environments || ["dev"]

    // Processing Data
    const getLatestPlan = (componentId: string, env: string) => {
        if (!plans) return null
        // Plans are ordered by timestamp desc from API (LIMIT 100 - acceptable for prototype)
        return plans.find((p: any) => p.component_id === componentId && p.environment === env)
    }

    const getStatus = (plan: any) => {
        if (!plan) return "unknown"
        const changes = plan.terraform_plan?.resource_changes || []
        // expanded logic: check actions for non-noop
        const hasDrift = changes.some((rc: any) => {
            const actions = rc.change?.actions || []
            return actions.some((action: string) => ["create", "update", "delete"].includes(action))
        })
        return hasDrift ? "drift" : "aligned"
    }

    // Metrics
    const totalComponents = components?.length || 0
    let totalDrifted = 0
    let totalAligned = 0
    let totalUnknown = 0

    if (components && plans) {
        components.forEach((comp: any) => {
            environments.forEach((env: string) => {
                const plan = getLatestPlan(comp.id, env)
                const status = getStatus(plan)
                if (status === "drift") totalDrifted++
                if (status === "aligned") totalAligned++
                if (status === "unknown") totalUnknown++
            })
        })
    }

    // System Alignment Score (Aligned / (Aligned + Drifted)) * 100
    // Ignoring unknowns for score calculation usually makes sense, or treat as 0? Let's ignore unknowns for score.
    const knownStateCount = totalAligned + totalDrifted
    const alignmentScore = knownStateCount > 0 ? Math.round((totalAligned / knownStateCount) * 100) : 0

    return (
        <div className="p-6 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#14161A]">Project Overview</h1>
                    <p className="text-muted-foreground">High-level view of infrastructure drift across all environments.</p>
                </div>
                <DashboardActionMenu onUploadComplete={() => mutate()} />
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Alignment Score</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{alignmentScore}%</div>
                        <p className="text-xs text-muted-foreground">
                            of known states are aligned
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Drifted</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{totalDrifted}</div>
                        <p className="text-xs text-muted-foreground">
                            components with changes
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Aligned</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{totalAligned}</div>
                        <p className="text-xs text-muted-foreground">
                            components in sync
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Environments</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{environments.length}</div>
                        <p className="text-xs text-muted-foreground">
                            active environments
                        </p>
                    </CardContent>
                </Card>
            </div>



            <Tabs defaultValue="map" className="w-full">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold tracking-tight">Infrastructure State</h2>
                    <TabsList>
                        <TabsTrigger value="map">Map View</TabsTrigger>
                        <TabsTrigger value="table">Table View</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="map" className="mt-0">
                    <div className="space-y-8">
                        {Object.entries(groupEnvironments(environments, activeProject?.environments_config)).map(([group, regions]) => (
                            <div key={group} className="space-y-4">
                                <h3 className="text-xl font-bold text-foreground/80 border-b pb-2">{group}</h3>
                                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                                    {Object.entries(regions).map(([region, envs]) => (
                                        <Card key={region} className="overflow-hidden">
                                            <CardHeader className="bg-muted/30 pb-3">
                                                <CardTitle className="text-base font-medium flex items-center justify-between">
                                                    {region}
                                                    <Badge variant="outline" className="ml-2 bg-background">{envs.length} envs</Badge>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 space-y-4">
                                                {envs.map(env => (
                                                    <div key={env} className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{env}</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {components?.map((comp: any) => {
                                                                const isExcluded = (comp.excluded_environments || []).includes(env)
                                                                if (isExcluded) return null // Don't show excluded in map to reduce noise? Or show dimmed? Let's hide for now.

                                                                const plan = getLatestPlan(comp.id, env)
                                                                const status = getStatus(plan)

                                                                return (
                                                                    <div key={comp.id} className={`
                                                                        flex items-center justify-between p-2 rounded border text-xs
                                                                        ${status === 'aligned' ? 'bg-green-50/50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : ''}
                                                                        ${status === 'drift' ? 'bg-orange-50/50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800' : ''}
                                                                        ${status === 'unknown' ? 'bg-zinc-50 border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 opacity-70' : ''}
                                                                    `}>
                                                                        <span className="truncate mr-2 font-medium" title={comp.name}>{comp.name}</span>
                                                                        {status === 'aligned' && <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />}
                                                                        {status === 'drift' && <AlertTriangle className="h-3 w-3 text-orange-600 shrink-0" />}
                                                                        {status === 'unknown' && <HelpCircle className="h-3 w-3 text-zinc-400 shrink-0" />}
                                                                    </div>
                                                                )
                                                            })}
                                                            {(!components || components.length === 0) && <span className="text-xs text-muted-foreground italic col-span-2">No components</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="table" className="mt-0">
                    {/* Matrix View */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Drift Matrix</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[200px]">Component</TableHead>
                                        {environments.map((env: string, index: number) => (
                                            <TableHead key={env} className="text-center">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger className="flex items-center justify-center gap-1 w-full hover:bg-zinc-100 dark:hover:bg-zinc-800 py-1 rounded cursor-pointer outline-none">
                                                        {env}
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                const move = async () => {
                                                                    if (!activeProject || !project) return
                                                                    const currentEnvs = [...environments]
                                                                    const newIndex = index - 1
                                                                    if (newIndex < 0) return

                                                                    // Swap
                                                                    currentEnvs[index] = currentEnvs[newIndex]
                                                                    currentEnvs[newIndex] = env

                                                                    const updatedProject = { ...activeProject, environments: currentEnvs }
                                                                    const updatedProjects = project.map((p: any) => p.id === projectId ? updatedProject : p)

                                                                    try {
                                                                        await mutateProjects(
                                                                            updateProjectSettings(projectId, { environments: currentEnvs }).then(() => updatedProjects),
                                                                            {
                                                                                optimisticData: updatedProjects,
                                                                                rollbackOnError: true,
                                                                                revalidate: false
                                                                            }
                                                                        )
                                                                        toast.success("Environment moved left")
                                                                    } catch (e) {
                                                                        toast.error("Failed to reorder")
                                                                    }
                                                                }
                                                                move()
                                                            }}
                                                            disabled={index === 0}
                                                        >
                                                            <ArrowLeft className="mr-2 h-4 w-4" /> Move Left
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                const move = async () => {
                                                                    if (!activeProject || !project) return
                                                                    const currentEnvs = [...environments]
                                                                    const newIndex = index + 1
                                                                    if (newIndex >= currentEnvs.length) return

                                                                    // Swap
                                                                    currentEnvs[index] = currentEnvs[newIndex]
                                                                    currentEnvs[newIndex] = env

                                                                    const updatedProject = { ...activeProject, environments: currentEnvs }
                                                                    const updatedProjects = project.map((p: any) => p.id === projectId ? updatedProject : p)

                                                                    try {
                                                                        await mutateProjects(
                                                                            updateProjectSettings(projectId, { environments: currentEnvs }).then(() => updatedProjects),
                                                                            {
                                                                                optimisticData: updatedProjects,
                                                                                rollbackOnError: true,
                                                                                revalidate: false
                                                                            }
                                                                        )
                                                                        toast.success("Environment moved right")
                                                                    } catch (e) {
                                                                        toast.error("Failed to reorder")
                                                                    }
                                                                }
                                                                move()
                                                            }}
                                                            disabled={index === environments.length - 1}
                                                        >
                                                            <ArrowRight className="mr-2 h-4 w-4" /> Move Right
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!components ? (
                                        <TableRow>
                                            <TableCell colSpan={environments.length + 1} className="text-center h-24">Loading...</TableCell>
                                        </TableRow>
                                    ) : components.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={environments.length + 1} className="text-center h-24">No components found.</TableCell>
                                        </TableRow>
                                    ) : (
                                        components.map((comp: any) => (
                                            <TableRow key={comp.id}>
                                                <TableCell className="font-medium">{comp.name}</TableCell>
                                                {environments.map((env: string) => {
                                                    const isExcluded = (comp.excluded_environments || []).includes(env)
                                                    const plan = getLatestPlan(comp.id, env)
                                                    const status = isExcluded ? "excluded" : getStatus(plan)

                                                    const toggleExclusion = async () => {
                                                        const currentExcluded = comp.excluded_environments || []
                                                        const newExcluded = isExcluded
                                                            ? currentExcluded.filter((e: string) => e !== env)
                                                            : [...currentExcluded, env]

                                                        // Optimistic update
                                                        const updatedComponents = components.map((c: any) => {
                                                            if (c.id === comp.id) {
                                                                return { ...c, excluded_environments: newExcluded }
                                                            }
                                                            return c
                                                        })

                                                        try {
                                                            await mutateComponents(
                                                                updateComponent(comp.id, projectId, { excluded_environments: newExcluded }).then(() => updatedComponents),
                                                                {
                                                                    optimisticData: updatedComponents,
                                                                    rollbackOnError: true,
                                                                    revalidate: false
                                                                }
                                                            )
                                                            toast.success(isExcluded ? `Checked ${comp.name} for ${env}` : `Excluded ${comp.name} from ${env}`)
                                                        } catch (error) {
                                                            console.error("Failed to update component exclusion", error)
                                                            toast.error("Failed to update exclusion")
                                                        }
                                                    }

                                                    return (
                                                        <TableCell key={env} className="text-center p-0">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <div className="flex justify-center h-full w-full py-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                                                        {status === "aligned" && (
                                                                            <div title="Aligned" className="p-1 rounded-full bg-green-100 dark:bg-green-900/30">
                                                                                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                                            </div>
                                                                        )}
                                                                        {status === "drift" && (
                                                                            <div title="Drift Detected" className="p-1 rounded-full bg-orange-100 dark:bg-orange-900/30">
                                                                                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                                                            </div>
                                                                        )}
                                                                        {status === "unknown" && (
                                                                            <div title="No Plan" className="p-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
                                                                                <HelpCircle className="h-5 w-5 text-zinc-400" />
                                                                            </div>
                                                                        )}
                                                                        {status === "excluded" && (
                                                                            <div title="Excluded" className="p-1 rounded-full bg-zinc-100 dark:bg-zinc-800 opacity-50">
                                                                                <Ban className="h-5 w-5 text-zinc-400" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent>
                                                                    <DropdownMenuItem onClick={toggleExclusion}>
                                                                        {isExcluded ? (
                                                                            <>
                                                                                <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                                                                                Include in {env}
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Ban className="mr-2 h-4 w-4 text-zinc-500" />
                                                                                Exclude from {env}
                                                                            </>
                                                                        )}
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    )
                                                })}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div >
    )
}
