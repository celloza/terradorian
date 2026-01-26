"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, MinusCircle, RefreshCw, Pencil, Eye, CheckCircle, ChevronDown, ChevronRight, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

export interface ResourceChange {
    address: string
    type: string
    resource_group?: string
    environment?: string // Added
    componentId?: string // Added
    change: {
        actions: string[]
        before: any
        after: any
    }
}

export interface ResourceListProps {
    changes: ResourceChange[]
    groupBy?: "none" | "resource_group" | "type" | "environment"
}

function getChangeStatus(actions: string[]) {
    // Exact matches
    if (actions.length === 1 && actions[0] === "create") return { icon: PlusCircle, label: "Create", color: "text-green-600", bg: "bg-green-100", type: "create" }
    if (actions.length === 1 && actions[0] === "delete") return { icon: MinusCircle, label: "Destroy", color: "text-red-600", bg: "bg-red-100", type: "delete" }
    if (actions.length === 1 && actions[0] === "update") return { icon: Pencil, label: "Update", color: "text-yellow-600", bg: "bg-yellow-100", type: "update" }
    if (actions.length === 1 && actions[0] === "read") return { icon: Eye, label: "Read", color: "text-blue-600", bg: "bg-blue-100", type: "read" }
    if (actions.length === 1 && actions[0] === "no-op") return { icon: CheckCircle, label: "No Changes", color: "text-gray-500", bg: "bg-gray-100", type: "no-op" }

    // Complex matches
    if (actions.includes("create") && actions.includes("delete")) return { icon: RefreshCw, label: "Replace", color: "text-orange-600", bg: "bg-orange-100", type: "replace" }

    return { icon: CheckCircle, label: "No Changes (Implicit)", color: "text-gray-400", bg: "bg-gray-50", type: "no-op" }
}

function getGroupName(change: ResourceChange, groupBy: string): string {
    if (groupBy === "type") return change.type
    if (groupBy === "environment") return change.environment || "Unknown"
    if (groupBy === "resource_group") {
        const rg = change.resource_group || change.change.after?.resource_group_name || change.change.before?.resource_group_name
        return rg || "Ungrouped Resources"
    }
    return "All Resources"
}

type SortKey = "address" | "type" | "resource_group" | "environment" | "change"
type SortDir = "asc" | "desc"

export function ResourceList({ changes, groupBy = "none" }: ResourceListProps) {
    const [filter, setFilter] = useState("all")
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; dir: SortDir }>({ key: "address", dir: "asc" })
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    // Toggle Group Expand
    const toggleGroup = (group: string) => {
        const newSet = new Set(expandedGroups)
        if (newSet.has(group)) newSet.delete(group)
        else newSet.add(group)
        setExpandedGroups(newSet)
    }

    // Expand all by default when groupBy changes/mounts? 
    // Maybe better to start collapsed or expanded. Let's start expanded.
    // Effect/Memo for default expansion could be complex. Allowing manual control for now.
    // Actually, user asked for "expand/collapse", usually implies start expanded or collapsed. 
    // Let's lazy init or just use a helper.

    // Filtering
    const filteredChanges = useMemo(() => {
        return changes.filter(change => {
            if (filter === "all") return true
            const status = getChangeStatus(change.change.actions)
            if (filter === "diff") return status.type !== "no-op" && status.type !== "read"
            return status.type === filter || (filter === "create" && status.type === "replace") || (filter === "delete" && status.type === "replace")
        })
    }, [changes, filter])

    // Grouping & Sorting
    const { flatItems, groups } = useMemo(() => {
        let items = [...filteredChanges]

        // 1. Sort
        items.sort((a, b) => {
            const aVal = sortConfig.key === "resource_group"
                ? (a.resource_group || a.change.after?.resource_group_name || "")
                : (a as any)[sortConfig.key] || ""
            const bVal = sortConfig.key === "resource_group"
                ? (b.resource_group || b.change.after?.resource_group_name || "")
                : (b as any)[sortConfig.key] || ""

            if (aVal < bVal) return sortConfig.dir === "asc" ? -1 : 1
            if (aVal > bVal) return sortConfig.dir === "asc" ? 1 : -1
            return 0
        })

        if (groupBy === "none") {
            return { flatItems: items, groups: null }
        }

        // 2. Group
        const grouped: Record<string, ResourceChange[]> = {}
        items.forEach(item => {
            const g = getGroupName(item, groupBy)
            if (!grouped[g]) grouped[g] = []
            grouped[g].push(item)
        })

        return { flatItems: null, groups: grouped }
    }, [filteredChanges, sortConfig, groupBy])

    const handleSort = (key: SortKey) => {
        setSortConfig(current => ({
            key,
            dir: current.key === key && current.dir === "asc" ? "desc" : "asc"
        }))
    }

    const SortIcon = ({ column }: { column: SortKey }) => {
        if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground opacity-50" />
        return sortConfig.dir === "asc" ? <ArrowUpDown className="ml-2 h-3 w-3 text-foreground" /> : <ArrowUpDown className="ml-2 h-3 w-3 text-foreground rotate-180" />
        // Note: ArrowUpDown isn't strictly directional icon, usually Chevron or ArrowUp/Down. 
        // But requested: "click again, sort other direction".
        // Let's use simple opacity if not active.
    }

    const groupKeys = groups ? Object.keys(groups).sort() : []

    // Helper to render row
    const renderRow = (change: ResourceChange) => {
        const status = getChangeStatus(change.change.actions)
        const Icon = status.icon
        const rg = change.resource_group || change.change.after?.resource_group_name || change.change.before?.resource_group_name

        return (
            <TableRow key={change.address + change.environment}>
                <TableCell>
                    <div className={cn("p-1 rounded-full w-fit", status.bg)}>
                        <Icon className={cn("h-4 w-4", status.color)} />
                    </div>
                </TableCell>
                <TableCell className="font-mono text-sm max-w-[300px] truncate" title={change.address}>{change.address}</TableCell>

                {/* Environment Column */}
                <TableCell className="text-sm">
                    <Badge variant="secondary" className="font-mono text-xs">{change.environment || 'dev'}</Badge>
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">{rg || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{change.type}</TableCell>
                <TableCell>
                    <Badge variant="outline" className={cn("border-0", status.color, status.bg)}>
                        {status.label}
                    </Badge>
                </TableCell>
            </TableRow>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-2">
                <ToggleGroup type="single" value={filter} onValueChange={(val) => val && setFilter(val)}>
                    <ToggleGroupItem value="all" aria-label="Toggle all">All</ToggleGroupItem>
                    <ToggleGroupItem value="diff" aria-label="Toggle diff">Changes</ToggleGroupItem>
                    <ToggleGroupItem value="create" aria-label="Toggle create" className="text-green-600">Create</ToggleGroupItem>
                    <ToggleGroupItem value="update" aria-label="Toggle update" className="text-yellow-600">Update</ToggleGroupItem>
                    <ToggleGroupItem value="delete" aria-label="Toggle delete" className="text-red-600">Delete</ToggleGroupItem>
                </ToggleGroup>
            </div>

            <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort("address")}>
                                <div className="flex items-center">Address <SortIcon column="address" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort("environment")}>
                                <div className="flex items-center">Env <SortIcon column="environment" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort("resource_group")}>
                                <div className="flex items-center">Resource Group <SortIcon column="resource_group" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort("type")}>
                                <div className="flex items-center">Type <SortIcon column="type" /></div>
                            </TableHead>
                            <TableHead>Change</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groupBy === "none" && flatItems && (
                            <>
                                {flatItems.length === 0 && (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No resources match.</TableCell></TableRow>
                                )}
                                {flatItems.map(renderRow)}
                            </>
                        )}

                        {groupBy !== "none" && groups && groupKeys.map(group => {
                            const isExpanded = expandedGroups.has(group)
                            return (
                                <>
                                    <TableRow
                                        key={"group-" + group}
                                        className="bg-zinc-50/80 hover:bg-zinc-100 cursor-pointer"
                                        onClick={() => toggleGroup(group)}
                                    >
                                        <TableCell colSpan={6}>
                                            <div className="flex items-center font-medium text-sm text-zinc-700 py-1">
                                                {isExpanded ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                                                {group}
                                                <Badge variant="secondary" className="ml-2 text-xs font-normal text-muted-foreground">
                                                    {groups[group].length}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    {isExpanded && groups[group].map(renderRow)}
                                </>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
