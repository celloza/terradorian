"use client"

import { use, useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"
import { fetcher, listComponents, listPlans } from "@/lib/api"
import { groupEnvironments } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeftRight, CheckCircle2, GitBranch, Layers, PackageSearch, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

type ResourceChange = {
    address?: string
    type?: string
    resource_group?: string
    change?: {
        actions?: string[]
    }
}

type PlanRecord = {
    id: string
    project_id?: string
    component_name?: string
    component_id?: string
    environment?: string
    branch?: string
    timestamp?: string
    terraform_version?: string
    terraform_plan?: {
        resource_changes?: ResourceChange[]
    }
}

type PlanWithMeta = PlanRecord & {
    group: string
    region: string
    componentLabel: string
}

type DiffKind = "added" | "removed" | "changed" | "unchanged"

type DiffRow = {
    address: string
    kind: DiffKind
    leftActions: string
    rightActions: string
    leftType: string
    rightType: string
    leftRg: string
    rightRg: string
}

type SelectionState = {
    branch: string
    group: string
    environment: string
    componentId: string
    selectedPlanId: string
}

const ACTION_ORDER = ["create", "update", "delete", "replace", "read", "no-op", "other"]

function normalizeActions(actions: string[] | undefined): string {
    if (!actions || actions.length === 0) return "no-op"

    const sorted = [...actions].sort()
    if (sorted.length === 2 && sorted.includes("create") && sorted.includes("delete")) {
        return "replace"
    }

    if (sorted.length === 1) {
        return sorted[0]
    }

    return sorted.join(",")
}

function actionCountForPlan(plan: PlanRecord | undefined): Record<string, number> {
    const counts: Record<string, number> = {
        create: 0,
        update: 0,
        delete: 0,
        replace: 0,
        read: 0,
        "no-op": 0,
        other: 0,
    }

    const changes = plan?.terraform_plan?.resource_changes || []
    changes.forEach((change) => {
        const kind = normalizeActions(change.change?.actions)
        if (counts[kind] === undefined) {
            counts.other += 1
            return
        }
        counts[kind] += 1
    })

    return counts
}

function calcDiff(left: PlanRecord | undefined, right: PlanRecord | undefined): DiffRow[] {
    if (!left || !right) return []

    const leftMap = new Map<string, ResourceChange>()
    const rightMap = new Map<string, ResourceChange>()

    ;(left.terraform_plan?.resource_changes || []).forEach((rc) => {
        if (!rc.address) return
        leftMap.set(rc.address, rc)
    })

    ;(right.terraform_plan?.resource_changes || []).forEach((rc) => {
        if (!rc.address) return
        rightMap.set(rc.address, rc)
    })

    const allAddresses = Array.from(new Set([...leftMap.keys(), ...rightMap.keys()])).sort()

    return allAddresses.map((address) => {
        const l = leftMap.get(address)
        const r = rightMap.get(address)

        const leftActions = normalizeActions(l?.change?.actions)
        const rightActions = normalizeActions(r?.change?.actions)

        const leftType = l?.type || "-"
        const rightType = r?.type || "-"
        const leftRg = l?.resource_group || "-"
        const rightRg = r?.resource_group || "-"

        let kind: DiffKind = "unchanged"

        if (!l && r) {
            kind = "added"
        } else if (l && !r) {
            kind = "removed"
        } else if (leftActions !== rightActions || leftType !== rightType || leftRg !== rightRg) {
            kind = "changed"
        }

        return {
            address,
            kind,
            leftActions,
            rightActions,
            leftType,
            rightType,
            leftRg,
            rightRg,
        }
    })
}

function badgeTone(kind: DiffKind): string {
    if (kind === "added") return "bg-emerald-100 text-emerald-700"
    if (kind === "removed") return "bg-rose-100 text-rose-700"
    if (kind === "changed") return "bg-amber-100 text-amber-700"
    return "bg-zinc-100 text-zinc-700"
}

function rowTone(kind: DiffKind): string {
    if (kind === "added") return "bg-emerald-50/80"
    if (kind === "removed") return "bg-rose-50/80"
    if (kind === "changed") return "bg-amber-50/70"
    return ""
}

function IngestionSelectorPanel({
    title,
    plans,
    selection,
    setSelection,
}: {
    title: string
    plans: PlanWithMeta[]
    selection: SelectionState
    setSelection: (next: SelectionState) => void
}) {
    const branchOptions = useMemo(() => {
        const branches = Array.from(new Set(plans.map((p) => p.branch || "unknown"))).sort()
        return ["all", ...branches]
    }, [plans])

    const groupOptions = useMemo(() => {
        const filtered = selection.branch === "all" ? plans : plans.filter((p) => (p.branch || "unknown") === selection.branch)
        const groups = Array.from(new Set(filtered.map((p) => p.group))).sort()
        return ["all", ...groups]
    }, [plans, selection.branch])

    const environmentOptions = useMemo(() => {
        let filtered = plans
        if (selection.branch !== "all") {
            filtered = filtered.filter((p) => (p.branch || "unknown") === selection.branch)
        }
        if (selection.group !== "all") {
            filtered = filtered.filter((p) => p.group === selection.group)
        }
        const envs = Array.from(new Set(filtered.map((p) => p.environment || "unknown"))).sort()
        return ["all", ...envs]
    }, [plans, selection.branch, selection.group])

    const componentOptions = useMemo(() => {
        let filtered = plans
        if (selection.branch !== "all") {
            filtered = filtered.filter((p) => (p.branch || "unknown") === selection.branch)
        }
        if (selection.group !== "all") {
            filtered = filtered.filter((p) => p.group === selection.group)
        }
        if (selection.environment !== "all") {
            filtered = filtered.filter((p) => (p.environment || "unknown") === selection.environment)
        }

        const items = Array.from(
            new Map(
                filtered.map((p) => [
                    p.component_id || "unknown",
                    { value: p.component_id || "unknown", label: p.componentLabel },
                ])
            ).values()
        ).sort((a, b) => a.label.localeCompare(b.label))

        return [{ value: "all", label: "All components" }, ...items]
    }, [plans, selection.branch, selection.group, selection.environment])

    const filteredPlans = useMemo(() => {
        return plans
            .filter((p) => (selection.branch === "all" ? true : (p.branch || "unknown") === selection.branch))
            .filter((p) => (selection.group === "all" ? true : p.group === selection.group))
            .filter((p) => (selection.environment === "all" ? true : (p.environment || "unknown") === selection.environment))
            .filter((p) => (selection.componentId === "all" ? true : (p.component_id || "unknown") === selection.componentId))
            .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""))
    }, [plans, selection])

    useEffect(() => {
        if (!selection.selectedPlanId) return
        const stillVisible = filteredPlans.some((p) => p.id === selection.selectedPlanId)
        if (!stillVisible) {
            setSelection({ ...selection, selectedPlanId: "" })
        }
    }, [filteredPlans, selection, setSelection])

    const nextHint = useMemo(() => {
        if (selection.branch === "all") return "Start with a branch to narrow the plan universe."
        if (selection.group === "all") return "Pick a group to align infrastructure context."
        if (selection.environment === "all") return "Select an environment to compare like-for-like plans."
        if (selection.componentId === "all") return "Choose a component to focus the drift surface."
        return "Pick one ingestion snapshot from the filtered candidates below."
    }, [selection])

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <PackageSearch className="h-4 w-4" />
                    {title}
                </CardTitle>
                <CardDescription>
                    Guided path builder with live narrowing. {filteredPlans.length} ingestion{filteredPlans.length === 1 ? "" : "s"} in scope.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="rounded-lg border bg-zinc-50 p-3 text-xs text-zinc-700">
                    <div className="flex items-center gap-2 font-medium text-zinc-900">
                        <Sparkles className="h-3.5 w-3.5" />
                        Smart guidance
                    </div>
                    <p className="mt-1">{nextHint}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>1. Branch</Label>
                        <Select
                            value={selection.branch}
                            onValueChange={(value) =>
                                setSelection({
                                    branch: value,
                                    group: "all",
                                    environment: "all",
                                    componentId: "all",
                                    selectedPlanId: "",
                                })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {branchOptions.map((b) => (
                                    <SelectItem key={b} value={b}>
                                        {b === "all" ? "All branches" : b}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label>2. Group</Label>
                        <Select
                            value={selection.group}
                            onValueChange={(value) =>
                                setSelection({
                                    ...selection,
                                    group: value,
                                    environment: "all",
                                    componentId: "all",
                                    selectedPlanId: "",
                                })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {groupOptions.map((g) => (
                                    <SelectItem key={g} value={g}>
                                        {g === "all" ? "All groups" : g}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label>3. Environment</Label>
                        <Select
                            value={selection.environment}
                            onValueChange={(value) =>
                                setSelection({
                                    ...selection,
                                    environment: value,
                                    componentId: "all",
                                    selectedPlanId: "",
                                })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {environmentOptions.map((env) => (
                                    <SelectItem key={env} value={env}>
                                        {env === "all" ? "All environments" : env}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label>4. Component</Label>
                        <Select
                            value={selection.componentId}
                            onValueChange={(value) =>
                                setSelection({
                                    ...selection,
                                    componentId: value,
                                    selectedPlanId: "",
                                })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {componentOptions.map((component) => (
                                    <SelectItem key={component.value} value={component.value}>
                                        {component.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="rounded-lg border">
                    <div className="border-b px-3 py-2 text-xs font-medium text-zinc-600">
                        5. Pick an ingestion snapshot (newest first)
                    </div>
                    <div className="max-h-[280px] overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Pick</TableHead>
                                    <TableHead>Component</TableHead>
                                    <TableHead>Env</TableHead>
                                    <TableHead>Branch</TableHead>
                                    <TableHead>When</TableHead>
                                    <TableHead>Changes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPlans.slice(0, 40).map((plan) => {
                                    const isSelected = plan.id === selection.selectedPlanId
                                    const changeCount = plan.terraform_plan?.resource_changes?.length || 0
                                    return (
                                        <TableRow
                                            key={plan.id}
                                            className={cn(isSelected && "bg-indigo-50")}
                                        >
                                            <TableCell>
                                                <Button
                                                    size="sm"
                                                    variant={isSelected ? "default" : "outline"}
                                                    onClick={() => setSelection({ ...selection, selectedPlanId: plan.id })}
                                                >
                                                    {isSelected ? "Selected" : "Select"}
                                                </Button>
                                            </TableCell>
                                            <TableCell className="max-w-[220px] truncate" title={plan.componentLabel}>{plan.componentLabel}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="font-mono text-[10px]">{plan.environment || "unknown"}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono text-[10px]">{plan.branch || "unknown"}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-zinc-600">
                                                {plan.timestamp
                                                    ? formatDistanceToNow(new Date(plan.timestamp), { addSuffix: true })
                                                    : "unknown"}
                                            </TableCell>
                                            <TableCell className="text-xs text-zinc-600">{changeCount}</TableCell>
                                        </TableRow>
                                    )
                                })}
                                {filteredPlans.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-20 text-center text-sm text-muted-foreground">
                                            No ingestions match this guided path.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export default function CompareIngestionsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)

    const { data: plans } = useSWR(listPlans(id, undefined, undefined, undefined, "all"), fetcher)
    const { data: components } = useSWR(listComponents(id), fetcher)
    const { data: projects } = useSWR("/list_projects", fetcher)

    const project = useMemo(() => projects?.find((p: any) => p.id === id), [projects, id])

    const componentById = useMemo(() => {
        const map = new Map<string, string>()
        ;(components || []).forEach((component: { id?: string; name?: string }) => {
            if (component.id && component.name) {
                map.set(component.id, component.name)
            }
        })
        return map
    }, [components])

    const enrichedPlans = useMemo<PlanWithMeta[]>(() => {
        const envConfig = project?.environments_config as Record<string, { group: string; region: string }> | undefined

        return ((plans || []) as PlanRecord[]).map((plan) => {
            const env = plan.environment || "unknown"
            const conf = envConfig?.[env] || { group: "Ungrouped", region: "Global" }
            const componentLabel = plan.component_name || componentById.get(plan.component_id || "") || plan.component_id || "Unknown"

            return {
                ...plan,
                group: conf.group || "Ungrouped",
                region: conf.region || "Global",
                componentLabel,
            }
        })
    }, [plans, project?.environments_config, componentById])

    const [leftSelection, setLeftSelection] = useState<SelectionState>({
        branch: "all",
        group: "all",
        environment: "all",
        componentId: "all",
        selectedPlanId: "",
    })

    const [rightSelection, setRightSelection] = useState<SelectionState>({
        branch: "all",
        group: "all",
        environment: "all",
        componentId: "all",
        selectedPlanId: "",
    })

    const leftPlan = useMemo(
        () => enrichedPlans.find((p) => p.id === leftSelection.selectedPlanId),
        [enrichedPlans, leftSelection.selectedPlanId]
    )

    const rightPlan = useMemo(
        () => enrichedPlans.find((p) => p.id === rightSelection.selectedPlanId),
        [enrichedPlans, rightSelection.selectedPlanId]
    )

    const diffRows = useMemo(() => calcDiff(leftPlan, rightPlan), [leftPlan, rightPlan])

    const [showUnchanged, setShowUnchanged] = useState(false)

    const visibleDiffRows = useMemo(() => {
        if (showUnchanged) return diffRows
        return diffRows.filter((r) => r.kind !== "unchanged")
    }, [diffRows, showUnchanged])

    const diffSummary = useMemo(() => {
        return {
            added: diffRows.filter((r) => r.kind === "added").length,
            removed: diffRows.filter((r) => r.kind === "removed").length,
            changed: diffRows.filter((r) => r.kind === "changed").length,
            unchanged: diffRows.filter((r) => r.kind === "unchanged").length,
        }
    }, [diffRows])

    const leftCounts = useMemo(() => actionCountForPlan(leftPlan), [leftPlan])
    const rightCounts = useMemo(() => actionCountForPlan(rightPlan), [rightPlan])

    const groupedEnvironments = useMemo(() => {
        const envs = Array.from(new Set(enrichedPlans.map((p) => p.environment || "unknown")))
        return groupEnvironments(envs, project?.environments_config)
    }, [enrichedPlans, project?.environments_config])

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-[#14161A]">Compare Ingestions</h1>
                <p className="text-sm text-muted-foreground max-w-4xl">
                    Select two ingestion snapshots and compare Terraform drift semantically. The guided selectors help you narrow by branch,
                    group, environment, and component before choosing a specific ingestion.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <IngestionSelectorPanel
                    title="Left Ingestion"
                    plans={enrichedPlans}
                    selection={leftSelection}
                    setSelection={setLeftSelection}
                />

                <IngestionSelectorPanel
                    title="Right Ingestion"
                    plans={enrichedPlans}
                    selection={rightSelection}
                    setSelection={setRightSelection}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ArrowLeftRight className="h-4 w-4" />
                        Terraform Delta Panel
                    </CardTitle>
                    <CardDescription>
                        Bottom panel highlights additions, removals, and semantic changes by resource address and action profile.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!leftPlan || !rightPlan ? (
                        <div className="rounded-lg border border-dashed bg-zinc-50 p-8 text-center text-sm text-zinc-600">
                            Select one ingestion in each top panel to unlock the diff view.
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                <div className="rounded-lg border p-3">
                                    <div className="text-xs text-zinc-500">Left snapshot</div>
                                    <div className="mt-1 font-medium">{leftPlan.componentLabel}</div>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                        <Badge variant="outline" className="font-mono"><GitBranch className="mr-1 h-3 w-3" />{leftPlan.branch || "unknown"}</Badge>
                                        <Badge variant="secondary" className="font-mono">{leftPlan.environment || "unknown"}</Badge>
                                        <Badge variant="secondary">{leftPlan.group}</Badge>
                                        <Badge variant="secondary">{leftPlan.region}</Badge>
                                    </div>
                                </div>

                                <div className="rounded-lg border p-3">
                                    <div className="text-xs text-zinc-500">Right snapshot</div>
                                    <div className="mt-1 font-medium">{rightPlan.componentLabel}</div>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                        <Badge variant="outline" className="font-mono"><GitBranch className="mr-1 h-3 w-3" />{rightPlan.branch || "unknown"}</Badge>
                                        <Badge variant="secondary" className="font-mono">{rightPlan.environment || "unknown"}</Badge>
                                        <Badge variant="secondary">{rightPlan.group}</Badge>
                                        <Badge variant="secondary">{rightPlan.region}</Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                <div className="rounded-lg border bg-emerald-50 p-3">
                                    <div className="text-xs text-emerald-700">Added</div>
                                    <div className="text-2xl font-semibold text-emerald-800">{diffSummary.added}</div>
                                </div>
                                <div className="rounded-lg border bg-rose-50 p-3">
                                    <div className="text-xs text-rose-700">Removed</div>
                                    <div className="text-2xl font-semibold text-rose-800">{diffSummary.removed}</div>
                                </div>
                                <div className="rounded-lg border bg-amber-50 p-3">
                                    <div className="text-xs text-amber-700">Changed</div>
                                    <div className="text-2xl font-semibold text-amber-800">{diffSummary.changed}</div>
                                </div>
                                <div className="rounded-lg border bg-zinc-50 p-3">
                                    <div className="text-xs text-zinc-700">Unchanged</div>
                                    <div className="text-2xl font-semibold text-zinc-800">{diffSummary.unchanged}</div>
                                </div>
                            </div>

                            <div className="rounded-lg border">
                                <div className="flex items-center justify-between border-b px-3 py-2">
                                    <div className="text-sm font-medium text-zinc-700 flex items-center gap-2">
                                        <Layers className="h-4 w-4" />
                                        Action profile delta (right - left)
                                    </div>
                                </div>
                                <div className="p-3">
                                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
                                        {ACTION_ORDER.map((action) => {
                                            const delta = (rightCounts[action] || 0) - (leftCounts[action] || 0)
                                            const tone = delta > 0 ? "text-emerald-700" : delta < 0 ? "text-rose-700" : "text-zinc-600"
                                            return (
                                                <div key={action} className="rounded-md border bg-zinc-50 p-2 text-xs">
                                                    <div className="font-medium text-zinc-700">{action}</div>
                                                    <div className={cn("mt-1 text-sm font-semibold", tone)}>
                                                        {delta > 0 ? "+" : ""}
                                                        {delta}
                                                    </div>
                                                    <div className="text-[11px] text-zinc-500">{`${leftCounts[action] || 0} -> ${rightCounts[action] || 0}`}</div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="text-sm text-zinc-600 flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-zinc-500" />
                                    Semantic diff keyed by resource address
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setShowUnchanged((v) => !v)}>
                                    {showUnchanged ? "Hide unchanged" : "Show unchanged"}
                                </Button>
                            </div>

                            <div className="rounded-lg border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Address</TableHead>
                                            <TableHead>Left Action</TableHead>
                                            <TableHead>Right Action</TableHead>
                                            <TableHead>Left RG</TableHead>
                                            <TableHead>Right RG</TableHead>
                                            <TableHead>Type Delta</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {visibleDiffRows.map((row) => (
                                            <TableRow key={row.address} className={rowTone(row.kind)}>
                                                <TableCell>
                                                    <Badge className={cn("border-0", badgeTone(row.kind))}>{row.kind}</Badge>
                                                </TableCell>
                                                <TableCell className="max-w-[420px] truncate font-mono text-xs" title={row.address}>{row.address}</TableCell>
                                                <TableCell className="font-mono text-xs">{row.leftActions}</TableCell>
                                                <TableCell className="font-mono text-xs">{row.rightActions}</TableCell>
                                                <TableCell className="max-w-[220px] truncate text-xs" title={row.leftRg}>{row.leftRg}</TableCell>
                                                <TableCell className="max-w-[220px] truncate text-xs" title={row.rightRg}>{row.rightRg}</TableCell>
                                                <TableCell className="text-xs">
                                                    {row.leftType === row.rightType ? row.leftType : `${row.leftType} -> ${row.rightType}`}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {visibleDiffRows.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-20 text-center text-sm text-muted-foreground">
                                                    No visible differences for the selected snapshots.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {groupedEnvironments && Object.keys(groupedEnvironments).length === 0 && (
                <div className="text-xs text-zinc-500">No environment grouping metadata found for this project.</div>
            )}
        </div>
    )
}
