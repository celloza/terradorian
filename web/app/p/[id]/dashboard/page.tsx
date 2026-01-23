"use client"

import { use } from "react"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { fetcher, listPlans } from "@/lib/api"
import { ProjectDashboard } from "@/components/project-dashboard"
import { DashboardActionMenu } from "@/components/dashboard-action-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { History, EyeOff } from "lucide-react"

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const searchParams = useSearchParams()
    const env = searchParams.get("env") || "dev"

    const { data: plans, mutate } = useSWR(listPlans(id, env), fetcher)

    return (
        <div className="p-6 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#14161A]">Overview <span className="text-muted-foreground font-normal text-lg ml-2">({env})</span></h1>
                    <p className="text-muted-foreground">High-level view of your infrastructure drift.</p>
                </div>
                <DashboardActionMenu onUploadComplete={() => mutate()} />
            </div>

            <ProjectDashboard plans={plans} />

            {/* Recent Activity / Drift Reports */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold tracking-tight flex items-center text-[#14161A]">
                    <History className="mr-2 h-5 w-5" /> Recent Ingestions
                </h2>
                <div className="rounded-md border bg-white shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-zinc-50">
                                <TableHead>Timestamp</TableHead>
                                <TableHead>Component</TableHead>
                                <TableHead>TF Version</TableHead>
                                <TableHead>Providers</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!plans ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">Loading...</TableCell>
                                </TableRow>
                            ) : plans.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <EyeOff className="h-6 w-6" />
                                            No drift reports found.
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                plans.slice(0, 10).map((plan: any) => (
                                    <TableRow key={plan.id}>
                                        <TableCell className="font-medium text-zinc-900">{new Date(plan.timestamp).toLocaleString()}</TableCell>
                                        <TableCell>{plan.component_name || "Unknown"}</TableCell>
                                        <TableCell>
                                            <span className="font-mono text-xs bg-zinc-100 px-2 py-1 rounded">{plan.terraform_version || "N/A"}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {(plan.providers || []).map((p: string) => (
                                                    <Badge key={p} variant="outline" className="text-[10px] px-1 py-0 font-normal">{p}</Badge>
                                                ))}
                                                {(!plan.providers || plan.providers.length === 0) && <span className="text-muted-foreground">-</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Ingested</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
