"use client"

import { useState } from "react"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
    Plus,
    Trash2,
    Edit3,
    CheckCircle,
    ArrowRight,
    HelpCircle,
    FileJson,
    X,
    Search,
    ChevronDown,
    ChevronRight,
} from "lucide-react"

interface PlanViewerProps {
    plan: any
}

export function PlanViewer({ plan }: PlanViewerProps) {
    const [selectedResource, setSelectedResource] = useState<any>(null)
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
        unchanged: true
    })

    const toggleSection = (section: string) => {
        setCollapsedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }))
    }

    if (!plan || !plan.terraform_plan || !plan.terraform_plan.resource_changes) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileJson className="h-10 w-10 mb-2 opacity-50" />
                <p>No valid plan data found.</p>
            </div>
        )
    }

    // Process resources
    const changes = plan.terraform_plan.resource_changes
    const groupedChanges: Record<string, any[]> = {
        create: [],
        update: [],
        delete: [],
        replace: [], // create + delete
        unchanged: []
    }

    changes.forEach((rc: any) => {
        const actions = rc.change.actions
        if (actions.includes("create") && actions.includes("delete")) {
            groupedChanges.replace.push(rc)
        } else if (actions.includes("create")) {
            groupedChanges.create.push(rc)
        } else if (actions.includes("delete")) {
            groupedChanges.delete.push(rc)
        } else if (actions.includes("update")) {
            groupedChanges.update.push(rc)
        } else {
            groupedChanges.unchanged.push(rc) // no-op, read, etc.
        }
    })

    const getActionIcon = (type: string) => {
        switch (type) {
            case "create": return <Plus className="h-3 w-3" />
            case "delete": return <Trash2 className="h-3 w-3" />
            case "update": return <Edit3 className="h-3 w-3" />
            case "replace": return <div className="flex items-center"><Trash2 className="h-3 w-3 mr-1" /><ArrowRight className="h-2 w-2 mr-1" /><Plus className="h-3 w-3" /></div>
            default: return <HelpCircle className="h-3 w-3" />
        }
    }

    const getActionColor = (type: string) => {
        switch (type) {
            case "create": return "text-green-600 bg-green-50 border-green-200"
            case "delete": return "text-red-600 bg-red-50 border-red-200"
            case "update": return "text-amber-600 bg-amber-50 border-amber-200"
            case "replace": return "text-purple-600 bg-purple-50 border-purple-200"
            default: return "text-zinc-600 bg-zinc-50 border-zinc-200"
        }
    }

    // Sort keys to render in specific order
    const orderedKeys = ["create", "update", "delete", "replace", "unchanged"]

    return (
        <div className="flex h-full overflow-hidden border rounded-md">
            {/* Left Sidebar: Resource List */}
            <div className="w-1/3 min-w-[300px] max-w-[450px] border-r bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col h-full overflow-hidden">
                <div className="p-3 border-b bg-background">
                    <h3 className="font-semibold text-sm">Changes</h3>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-4">
                    {orderedKeys.map(key => {
                        const items = groupedChanges[key]
                        if (items.length === 0) return null
                        const isCollapsed = collapsedSections[key]

                        return (
                            <div key={key} className="space-y-1">
                                <button
                                    onClick={() => toggleSection(key)}
                                    className="flex items-center w-full text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                >
                                    {isCollapsed ? <ChevronRight className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                                    {key} ({items.length})
                                </button>

                                {!isCollapsed && (
                                    <div className="space-y-1 pl-2">
                                        {items.map((item: any, idx: number) => {
                                            const isSelected = selectedResource === item
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => setSelectedResource(item)}
                                                    className={cn(
                                                        "text-sm p-2 rounded cursor-pointer border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2",
                                                        isSelected ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800" : "bg-white border-transparent dark:bg-zinc-950"
                                                    )}
                                                >
                                                    <Badge variant="outline" className={cn("px-1 py-0 h-5 font-normal shrink-0", getActionColor(key))}>
                                                        {getActionIcon(key)}
                                                    </Badge>
                                                    <div className="flex flex-col truncate">
                                                        <span className="font-medium truncate" title={item.name}>{item.name}</span>
                                                        <span className="text-xs text-muted-foreground truncate" title={item.type}>{item.type}</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Right Content: JSON Reader */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#1e1e1e]">
                <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#3e3e42] text-zinc-400 text-xs">
                    <span className="font-mono">
                        {selectedResource ? `${selectedResource.type}.${selectedResource.name}` : "full_plan.json"}
                    </span>
                    {selectedResource && (
                        <button
                            onClick={() => setSelectedResource(null)}
                            className="hover:text-white flex items-center gap-1"
                        >
                            <X className="h-3 w-3" /> Clear Selection
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-hidden relative">
                    <SyntaxHighlighter
                        language="json"
                        style={vscDarkPlus}
                        customStyle={{ margin: 0, padding: '1rem', height: '100%', fontSize: '13px', lineHeight: '1.5' }}
                        showLineNumbers={true}
                        wrapLines={true}
                    >
                        {JSON.stringify(selectedResource || plan.terraform_plan, null, 2)}
                    </SyntaxHighlighter>
                </div>
            </div>
        </div>
    )
}
