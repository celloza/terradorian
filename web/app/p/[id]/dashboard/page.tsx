"use client"

import { use, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import useSWR from "swr"
import { fetcher, listPlans, deletePlan } from "@/lib/api"
import { ProjectDashboard } from "@/components/project-dashboard"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Trash2, Network, History, EyeOff, Eye, Loader2 } from "lucide-react";
import { PlanViewer } from "@/components/plan-viewer";
import { getPlan } from "@/lib/api";

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const searchParams = useSearchParams()
    const env = searchParams.get("env") || "dev"
    const projectId = id // Alias for clarity if needed, or just use id

    const { data: plans, mutate } = useSWR(listPlans(id, undefined, env), fetcher)

    const [deleteOpen, setDeleteOpen] = useState(false)
    const [planToDelete, setPlanToDelete] = useState<any>(null)

    const [viewOpen, setViewOpen] = useState(false)
    const [planToView, setPlanToView] = useState<any>(null)
    const [viewLoading, setViewLoading] = useState(false)
    const [fullPlan, setFullPlan] = useState<any>(null)

    const handleDelete = async () => {
        if (!planToDelete) return
        try {
            await deletePlan(planToDelete.id)
            toast.success("Plan deleted")
            mutate()
            setDeleteOpen(false)
            setPlanToDelete(null)
        } catch (e) {
            toast.error("Failed to delete plan")
        }
    }

    const handleView = async (plan: any) => {
        setPlanToView(plan)
        setViewOpen(true)
        setViewLoading(true)
        setFullPlan(null)
        try {
            const data = await getPlan(plan.id)
            setFullPlan(data)
        } catch (e) {
            toast.error("Failed to load plan details")
        } finally {
            setViewLoading(false)
        }
    }

    const getPlanSummary = (planData: any) => {
        if (!planData || !planData.terraform_plan || !planData.terraform_plan.resource_changes) return null;

        const summary = {
            added: 0,
            changed: 0,
            deleted: 0,
            replaced: 0,
            moved: 0,
            imported: 0
        };

        planData.terraform_plan.resource_changes.forEach((rc: any) => {
            const actions = rc.change.actions;
            if (actions.includes('create') && actions.includes('delete')) {
                summary.replaced++;
            } else if (actions.includes('create')) {
                summary.added++;
            } else if (actions.includes('delete')) {
                summary.deleted++;
            } else if (actions.includes('update')) {
                summary.changed++;
            }
            // Terraform plan JSON actions can be: ["no-op"], ["create"], ["read"], ["update"], ["delete", "create"], ["create", "delete"], ["delete"]
            // "moved" is usually a separate property or action, effectively update? For basic counts, standard TF actions are create, update, delete.
            // "imported" is 'import'.
        });

        return summary;
    }

    return (
        <div className="p-6 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#14161A]">Environment <span className="text-muted-foreground font-normal text-lg ml-2">({env})</span></h1>
                    <p className="text-muted-foreground">Detailed drift analysis for this environment.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" asChild>
                        <Link href={`/p/${id}/graph?env=${env}`}>
                            <Network className="mr-2 h-4 w-4" />
                            View Graph
                        </Link>
                    </Button>
                </div>
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
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Ingested</Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-blue-500 hover:bg-blue-50"
                                                    onClick={() => handleView(plan)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-50"
                                                    onClick={() => {
                                                        setPlanToDelete(plan)
                                                        setDeleteOpen(true)
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* View Plan Dialog */}
            <Dialog open={viewOpen} onOpenChange={setViewOpen}>
                <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Terraform Plan Details</DialogTitle>
                        <DialogDescription>
                            Viewing plan for <span className="font-semibold text-foreground">{planToView?.component_name}</span> from <span className="font-mono">{planToView ? new Date(planToView.timestamp).toLocaleString() : ''}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden min-h-0 py-4">
                        {viewLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : fullPlan ? (
                            <PlanViewer plan={fullPlan} />
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">Failed to load plan content.</div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Plan?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this plan? <br />
                            <span className="font-mono text-xs text-muted-foreground">{planToDelete?.id}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete}>Delete Plan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    )
}
