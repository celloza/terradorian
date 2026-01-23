"use client"

import { useState, use } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { fetcher } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Trash2, AlertTriangle } from "lucide-react"

export default function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()

    // We should fetch project details to get the name for validation
    const { data: projects } = useSWR("/list_projects", fetcher)
    const project = projects?.find((p: any) => p.id === id)

    const [isDeleting, setIsDeleting] = useState(false)
    const [confirmName, setConfirmName] = useState("")
    const [deleteLoading, setDeleteLoading] = useState(false)

    const handleDelete = async () => {
        if (!project || confirmName !== project.name) return

        setDeleteLoading(true)
        try {
            // TODO: Implement delete_project endpoint
            // For now just simulate
            // await deleteProject(id)
            alert("Project deletion not fully implemented on backend yet.")
            // router.push("/")
        } catch (e) {
            alert("Failed to delete project")
        } finally {
            setDeleteLoading(false)
            setIsDeleting(false)
        }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#14161A]">Project Settings</h1>
                <p className="text-muted-foreground">Manage project lifecycle.</p>
            </div>

            <Card className="border-red-200 bg-red-50/30">
                <CardHeader>
                    <CardTitle className="text-red-700 flex items-center">
                        <AlertTriangle className="mr-2 h-5 w-5" /> Danger Zone
                    </CardTitle>
                    <CardDescription className="text-red-600/80">
                        Irreversible actions for this project.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-red-900">Delete Project</h4>
                            <p className="text-sm text-red-700/70">
                                Permanently delete this project and all associated data, plans, and tokens.
                            </p>
                        </div>
                        <Button variant="destructive" onClick={() => setIsDeleting(true)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Project
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Delete Confirmation Modal */}
            <Dialog open={isDeleting} onOpenChange={(open) => {
                if (!open) setConfirmName("")
                setIsDeleting(open)
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Are you absolutely sure?</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. This will permanently delete the project
                            <span className="font-semibold text-foreground mx-1">{project?.name}</span>
                            and remove all data.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <Label>Type the project name to confirm</Label>
                        <Input
                            value={confirmName}
                            onChange={(e) => setConfirmName(e.target.value)}
                            placeholder={project?.name}
                            className="font-mono bg-red-50"
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleting(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={!project || confirmName !== project.name || deleteLoading}
                        >
                            {deleteLoading ? "Deleting..." : "I understand, delete this project"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
