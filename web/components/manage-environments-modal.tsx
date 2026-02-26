"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { fetcher, addEnvironment, deleteEnvironment } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Box } from "lucide-react"

interface ManageEnvironmentsModalProps {
    isOpen: boolean
    onChange: (open: boolean) => void
}

export function ManageEnvironmentsModal({ isOpen, onChange }: ManageEnvironmentsModalProps) {
    const params = useParams()
    const projectId = params.id as string

    // Valid for environments to be fetched from project details
    const { data: projects, mutate } = useSWR("/list_projects", fetcher)
    const project = projects?.find((p: any) => p.id === projectId)
    const environments = project?.environments || []

    const [newEnvName, setNewEnvName] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const handleCreate = async () => {
        if (!newEnvName) return
        setIsLoading(true)
        try {
            await addEnvironment(projectId, newEnvName)
            setNewEnvName("")
            mutate()
        } catch (e) {
            alert("Failed to add environment")
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async (envName: string) => {
        if (environments.length <= 1) {
            alert("A project must have at least one environment. Cannot delete the last environment.")
            return
        }

        if (!confirm(`Are you sure you want to delete the '${envName}' environment and all its plans?`)) return

        setIsLoading(true)
        try {
            await deleteEnvironment(projectId, envName)
            mutate()
        } catch (e) {
            alert("Failed to delete environment")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Manage Environments</DialogTitle>
                    <DialogDescription>Define deployment environments (e.g. dev, staging, prod).</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* List Existing */}
                    <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-2 bg-zinc-50 dark:bg-zinc-900">
                        {environments.map((env: string) => (
                            <div key={env} className="flex items-center justify-between p-2 bg-white dark:bg-zinc-800 rounded shadow-sm">
                                <span className="font-medium text-sm flex items-center">
                                    <Box className="h-3 w-3 mr-2 text-zinc-500" />
                                    {env}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-red-500"
                                    onClick={() => handleDelete(env)}
                                    disabled={environments.length <= 1 || isLoading}
                                    title={environments.length <= 1 ? "Cannot delete the last environment" : "Delete environment"}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                        {environments.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">No environments defined.</p>
                        )}
                    </div>

                    {/* Add New */}
                    <div className="flex items-end gap-2">
                        <div className="grid gap-1 flex-1">
                            <Label htmlFor="ename" className="text-xs">New Environment Name</Label>
                            <Input
                                id="ename"
                                value={newEnvName}
                                onChange={(e) => setNewEnvName(e.target.value)}
                                placeholder="e.g. staging"
                                className="h-8"
                            />
                        </div>
                        <Button size="sm" onClick={handleCreate} disabled={!newEnvName || isLoading}>
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
