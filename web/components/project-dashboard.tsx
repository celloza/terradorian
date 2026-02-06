"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { CheckCircle, AlertTriangle, Cloud, Plus, Trash2, Edit3, Activity } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

    const latestPlan = plans[0]
    const resourceChanges = latestPlan.terraform_plan?.resource_changes || []

    // Calculate Stats
    let createCount = 0
    let deleteCount = 0
    let updateCount = 0
    let noOpCount = 0

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

    const totalChanges = createCount + deleteCount + updateCount
    const isInSync = totalChanges === 0

    // Sync Percentage Calculation
    // Total Resources = (Unchanged) + (Resources Needing Change)
    const totalResources = noOpCount + totalChanges
    const syncPercentage = totalResources > 0 ? Math.round((noOpCount / totalResources) * 100) : 100

    const StatusIcon = isInSync ? CheckCircle : AlertTriangle
    const statusColor = isInSync ? "text-green-500" : "text-amber-500"
    const statusText = isInSync ? "In Sync" : "Drift Detected"

    // Extract Cloud Platform
    const cloudPlatform = latestPlan.cloud_platform || "Unknown Cloud"

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
    // Process plans for chart data (reverse to show chronological order)
    const data = [...plans].reverse().map(plan => {
        const changes = plan.terraform_plan?.resource_changes || []
        let total = 0
        let create = 0
        let del = 0
        let update = 0
        let unchanged = 0

        changes.forEach((rc: any) => {
            const actions = rc.change.actions
            // Simple counting logic
            if (actions.length === 1 && actions[0] === "create") create++
            else if (actions.length === 1 && actions[0] === "delete") del++
            else if (actions.length === 1 && actions[0] === "update") update++
            else if (actions.includes("create") && actions.includes("delete")) { create++; del++; } // replace
            else if (actions.includes("no-op") || actions.includes("read")) unchanged++

            // Total is sum of mutations needed
            if (actions.includes("create") || actions.includes("delete") || actions.includes("update")) {
                total++
            }
        })
        return {
            date: new Date(plan.timestamp).toLocaleDateString(),
            total,
            create,
            delete: del,
            update,
            unchanged,
            timestamp: plan.timestamp // for sorting if needed
        }
    })

    return (
        <div className="h-[300px] w-full">
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

                    {/* Detailed Lines (Dotted) */}
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
        </div>
    )
}
