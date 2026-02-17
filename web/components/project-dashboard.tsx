"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { CheckCircle, AlertTriangle, Cloud, Plus, Trash2, Edit3, Activity } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Deterministic color generator for components
const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + "00000".substring(0, 6 - c.length) + c;
}

interface ProjectDashboardProps {
    plans: any[]
}

export function ProjectDashboard({ plans }: ProjectDashboardProps) {
    if (!plans || plans.length === 0) {
        return (
            <div className="p-8 text-center border rounded-md bg-muted/20">
                <Cloud className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-lg font-medium">No Data Available</h3>
                <p className="text-muted-foreground">Ingest a Terraform plan to see dashboard insights.</p>
            </div>
        )
    }

    // 1. Group plans by component_id to get the latest state for each
    const latestComponentPlans = new Map<string, any>();

    // Plans are typically sorted by API, but let's ensure we process chronologically or just pick latest
    // The 'plans' prop is usually sorted newest first from the API.
    // We want the *latest* plan for each component.
    for (const plan of plans) {
        if (!plan.component_id) continue;
        if (!latestComponentPlans.has(plan.component_id)) {
            latestComponentPlans.set(plan.component_id, plan);
        }
    }

    // 2. Calculate Aggregate Stats
    let createCount = 0
    let deleteCount = 0
    let updateCount = 0
    let noOpCount = 0
    let cloudPlatform = "Unknown Cloud" // We'll just take the first one found or "Mixed"

    latestComponentPlans.forEach((plan) => {
        if (latestComponentPlans.size === 1) {
            cloudPlatform = plan.cloud_platform || "Unknown Cloud"
        } else if (latestComponentPlans.size > 1) {
            cloudPlatform = "Multiple Providers"
        }

        const resourceChanges = plan.terraform_plan?.resource_changes || []
        resourceChanges.forEach((rc: any) => {
            const actions = rc.change.actions
            if (actions.includes("create") && actions.includes("delete")) {
                createCount++
                deleteCount++
            } else if (actions.includes("create")) {
                createCount++
            } else if (actions.includes("delete")) {
                deleteCount++
            } else if (actions.includes("update")) {
                updateCount++
            } else if (actions.includes("read") || actions.includes("no-op")) {
                noOpCount++
            }
        })
    })

    const totalChanges = createCount + deleteCount + updateCount
    const isInSync = totalChanges === 0

    // Sync Percentage Calculation
    // Total Resources = (Unchanged) + (Resources Needing Change)
    const totalResources = noOpCount + totalChanges
    const syncPercentage = totalResources > 0 ? Math.round((noOpCount / totalResources) * 100) : 100

    const StatusIcon = isInSync ? CheckCircle : AlertTriangle
    const statusColor = isInSync ? "text-green-500" : "text-amber-500"
    const statusText = isInSync ? "In Sync" : "Drift Detected"

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="col-span-2 border-l-4 border-l-primary">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Infrastructure Status</CardTitle>
                        <StatusIcon className={`h-4 w-4 ${statusColor}`} />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <div className="text-2xl font-bold">{syncPercentage}%</div>
                            <div className="text-sm text-muted-foreground">Synced</div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {statusText} on {cloudPlatform}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">To Create</CardTitle>
                        <Plus className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{createCount}</div>
                        <p className="text-xs text-muted-foreground">New resources</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">To Delete</CardTitle>
                        <Trash2 className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{deleteCount}</div>
                        <p className="text-xs text-muted-foreground">Resources removed</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">To Update</CardTitle>
                        <Edit3 className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{updateCount}</div>
                        <p className="text-xs text-muted-foreground">Modifications</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Unchanged</CardTitle>
                        <CheckCircle className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{noOpCount}</div>
                        <p className="text-xs text-muted-foreground">Resources in sync</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Drift Over Time</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                    {plans.length > 1 ? (
                        <DriftChart plans={plans} />
                    ) : (
                        <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground bg-muted/10 rounded-md border border-dashed">
                            <Activity className="h-10 w-10 mb-4 opacity-50" />
                            <h4 className="font-medium text-lg">Not Enough Data</h4>
                            <p className="text-sm">This graph will show once there's enough data (2+ plans).</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

function DriftChart({ plans }: { plans: any[] }) {
    // 1. Sort plans chronologically (oldest to newest)
    const sortedPlans = [...plans].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // 2. Track latest state per component
    const componentState = new Map<string, { create: number, del: number, update: number, unchanged: number, total: number }>();
    const allComponentIds = new Set<string>();

    // 3. Helper to calculate stats for a single plan
    const getPlanStats = (plan: any) => {
        const changes = plan.terraform_plan?.resource_changes || []
        let stats = { create: 0, del: 0, update: 0, unchanged: 0, total: 0 }

        changes.forEach((rc: any) => {
            const actions = rc.change.actions
            if (actions.includes("create") && actions.includes("delete")) { stats.create++; stats.del++; }
            else if (actions.includes("create")) stats.create++
            else if (actions.includes("delete")) stats.del++
            else if (actions.includes("update")) stats.update++
            else if (actions.includes("no-op") || actions.includes("read")) stats.unchanged++

            if (actions.includes("create") || actions.includes("delete") || actions.includes("update")) {
                stats.total++
            }
        })
        return stats;
    }

    // 4. Generate data points
    const data = sortedPlans.map(plan => {
        // Update state for this component
        if (plan.component_id) {
            componentState.set(plan.component_id, getPlanStats(plan));
            allComponentIds.add(plan.component_id);
        }

        // Aggregate across all components
        let agg = { create: 0, del: 0, update: 0, unchanged: 0, total: 0 }
        const componentDrift: Record<string, number> = {};

        componentState.forEach((stats, compId) => {
            agg.create += stats.create
            agg.del += stats.del
            agg.update += stats.update
            agg.unchanged += stats.unchanged
            agg.total += stats.total

            // Store total drift for this component
            componentDrift[compId] = stats.total;
        })

        return {
            date: new Date(plan.timestamp).toLocaleDateString(),
            total: agg.total,
            create: agg.create,
            delete: agg.del,
            update: agg.update,
            unchanged: agg.unchanged,
            timestamp: plan.timestamp,
            ...componentDrift // Spread component drift stats into the data point
        }
    })

    return (
        <div className="w-full">
            <Tabs defaultValue="resource" className="w-full">
                <div className="flex justify-end mb-4 mr-6">
                    <TabsList>
                        <TabsTrigger value="resource">Per Resource</TabsTrigger>
                        <TabsTrigger value="component">Per Component</TabsTrigger>
                    </TabsList>
                </div>

                <div className="h-[300px] w-full">
                    <TabsContent value="resource" className="h-full mt-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="timestamp"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value}`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#000", border: "none", borderRadius: "8px", color: "#fff" }}
                                    itemStyle={{ color: "#fff" }}
                                    cursor={{ stroke: "#888888" }}
                                    labelFormatter={(value) => new Date(value).toLocaleString()}
                                />

                                {/* Resource Lines (Dotted) */}
                                <Line type="monotone" dataKey="create" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} name="Create" />
                                <Line type="monotone" dataKey="delete" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} name="Delete" />
                                <Line type="monotone" dataKey="update" stroke="#eab308" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} name="Update" />
                                <Line type="monotone" dataKey="unchanged" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} name="Unchanged" />

                                {/* Total Line (Solid) */}
                                <Line
                                    type="monotone"
                                    dataKey="total"
                                    stroke="#2563eb"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }}
                                    activeDot={{ r: 6, fill: "#2563eb" }}
                                    name="Total Drift"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </TabsContent>

                    <TabsContent value="component" className="h-full mt-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="timestamp"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value}`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#000", border: "none", borderRadius: "8px", color: "#fff" }}
                                    itemStyle={{ color: "#fff" }}
                                    cursor={{ stroke: "#888888" }}
                                    labelFormatter={(value) => new Date(value).toLocaleString()}
                                />

                                {/* Component Lines */}
                                {Array.from(allComponentIds).map((compId) => (
                                    <Line
                                        key={compId}
                                        type="monotone"
                                        dataKey={compId}
                                        stroke={stringToColor(compId)}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                        name={compId}
                                    />
                                ))}

                                {/* Total Line (Solid Reference) */}
                                <Line
                                    type="monotone"
                                    dataKey="total"
                                    stroke="#2563eb"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }}
                                    activeDot={{ r: 6, fill: "#2563eb" }}
                                    name="Total Drift"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
