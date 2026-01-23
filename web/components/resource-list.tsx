"use client"

import { useState } from "react"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, MinusCircle, RefreshCw, Pencil, Eye, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"


interface ResourceChange {
    address: string
    type: string
    resource_group?: string
    change: {
        actions: string[]
        before: any
        after: any
    }
}

export interface ResourceListProps {
    plan: any
    groupBy?: "none" | "resource_group" | "type"
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
    if (groupBy === "resource_group") {
        // Priority: Top-level field (new) -> Deep inspection (legacy/full plans)
        const rg = change.resource_group || change.change.after?.resource_group_name || change.change.before?.resource_group_name
        return rg || "Ungrouped Resources"
    }
    return "All Resources"
}

export function ResourceList({ plan, groupBy = "none" }: ResourceListProps) {
    const [filter, setFilter] = useState("all")

    if (!plan || !plan.terraform_plan || !plan.terraform_plan.resource_changes) {
        return <div className="p-4 text-center text-muted-foreground">No resource changes found in this plan.</div>
    }

    const changes: ResourceChange[] = plan.terraform_plan.resource_changes

    const filteredChanges = changes.filter(change => {
        if (filter === "all") return true
        const status = getChangeStatus(change.change.actions)
        if (filter === "diff") return status.type !== "no-op" && status.type !== "read"
        return status.type === filter || (filter === "create" && status.type === "replace") || (filter === "delete" && status.type === "replace")
    })

    // Grouping
    const groups: Record<string, ResourceChange[]> = {}
    if (groupBy === "none") {
        groups["All Resources"] = filteredChanges
    } else {
        filteredChanges.forEach(change => {
            const groupName = getGroupName(change, groupBy)
            if (!groups[groupName]) groups[groupName] = []
            groups[groupName].push(change)
        })
    }

    // Sort groups? Maybe.
    const groupNames = Object.keys(groups).sort()

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-2">
                <ToggleGroup type="single" value={filter} onValueChange={(val) => val && setFilter(val)}>
                    <ToggleGroupItem value="all" aria-label="Toggle all">All</ToggleGroupItem>
                    <ToggleGroupItem value="diff" aria-label="Toggle diff">Changes</ToggleGroupItem>
                    <ToggleGroupItem value="create" aria-label="Toggle create" className="text-green-600">Create</ToggleGroupItem>
                    <ToggleGroupItem value="update" aria-label="Toggle update" className="text-yellow-600">Update</ToggleGroupItem>
                    <ToggleGroupItem value="delete" aria-label="Toggle delete" className="text-red-600">Delete</ToggleGroupItem>
                </ToggleGroup>
            </div>

            {groupNames.map(groupName => (
                <div key={groupName} className="space-y-2">
                    {groupBy !== "none" && (
                        <h3 className="font-semibold text-sm text-zinc-500 uppercase tracking-wider pl-1">
                            {groupName} <span className="text-zinc-300 ml-2">({groups[groupName].length})</span>
                        </h3>
                    )}
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Address</TableHead>
                                    {groupBy !== "resource_group" && <TableHead>Resource Group</TableHead>}
                                    <TableHead>Type</TableHead>
                                    <TableHead>Change</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groups[groupName].length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={groupBy !== "resource_group" ? 5 : 4} className="h-24 text-center text-muted-foreground">
                                            No resources match filter.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {groups[groupName].map((change) => {
                                    const status = getChangeStatus(change.change.actions)
                                    const Icon = status.icon

                                    // Resolve RG for display if not grouped by it
                                    const resourceGroup = change.resource_group || change.change.after?.resource_group_name || change.change.before?.resource_group_name

                                    return (
                                        <TableRow key={change.address}>
                                            <TableCell>
                                                <div className={`p-1 rounded-full w-fit ${status.bg}`}>
                                                    <Icon className={`h-4 w-4 ${status.color}`} />
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm max-w-[300px] truncate" title={change.address}>{change.address}</TableCell>

                                            {groupBy !== "resource_group" && (
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {resourceGroup || "-"}
                                                </TableCell>
                                            )}

                                            <TableCell className="text-sm text-muted-foreground">{change.type}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`${status.color} ${status.bg} border-0`}>
                                                    {status.label}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            ))}

            {filteredChanges.length === 0 && groupNames.length === 0 && (
                <div className="text-center p-8 border rounded-md border-dashed text-muted-foreground">
                    No resources found matching filter.
                </div>
            )}
        </div>
    )
}
