"use client"

import { use } from "react"
import Link from "next/link"
import useSWR from "swr"
import { fetcher, listPlans, listComponents } from "@/lib/api" // Assuming listComponents is available or I need to add it to existing fetcher use
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Activity, CheckCircle2, AlertTriangle, HelpCircle, ArrowRight } from "lucide-react"
import { DashboardActionMenu } from "@/components/dashboard-action-menu"

export default function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = use(params)

    // Data Fetching
    const { data: project } = useSWR("/list_projects", fetcher)
    const { data: components } = useSWR(() => `/list_components?project_id=${projectId}`, fetcher)
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
                                {environments.map((env: string) => (
                                    <TableHead key={env} className="text-center">{env}</TableHead>
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
                                            const plan = getLatestPlan(comp.id, env)
                                            const status = getStatus(plan)

                                            return (
                                                <TableCell key={env} className="text-center">
                                                    <div className="flex justify-center">
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
                                                    </div>
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
        </div>
    )
}
