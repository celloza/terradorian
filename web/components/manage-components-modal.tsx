"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { fetcher, listComponents, createComponent } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Layers } from "lucide-react"

interface ManageComponentsModalProps {
    isOpen: boolean
    onChange: (open: boolean) => void
}

export function ManageComponentsModal({ isOpen, onChange }: ManageComponentsModalProps) {
    const params = useParams()
    const projectId = params.id as string
    const { data: components, mutate } = useSWR(projectId ? listComponents(projectId) : null, fetcher)

    const [newCompName, setNewCompName] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const handleCreate = async () => {
        if (!newCompName) return
        setIsLoading(true)
        try {
            await createComponent(projectId, newCompName)
            setNewCompName("")
            mutate()
        } catch (e) {
            alert("Failed to create component")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Manage Components</DialogTitle>
                    <DialogDescription>Define the logical components for this project.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* List Existing */}
                    <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-2 bg-zinc-50 dark:bg-zinc-900">
                        {components?.map((c: any) => (
                            <div key={c.id} className="flex items-center justify-between p-2 bg-white dark:bg-zinc-800 rounded shadow-sm">
                                <span className="font-medium text-sm">{c.name}</span>
                                {/* Delete not implemented yet, placeholder */}
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500" disabled title="Delete not implemented">
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                        {components?.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">No components found.</p>
                        )}
                    </div>

                    {/* Add New */}
                    <div className="flex items-end gap-2">
                        <div className="grid gap-1 flex-1">
                            <Label htmlFor="cname" className="text-xs">New Component Name</Label>
                            <Input
                                id="cname"
                                value={newCompName}
                                onChange={(e) => setNewCompName(e.target.value)}
                                placeholder="e.g. backend-api"
                                className="h-8"
                            />
                        </div>
                        <Button size="sm" onClick={handleCreate} disabled={!newCompName || isLoading}>
                            <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onChange(false)}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
