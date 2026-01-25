"use client"

import { useState, use } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { fetcher, deleteEnvironment, listComponents, deleteComponent } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Trash2, AlertTriangle, X } from "lucide-react"
import { toast } from "sonner"

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

    // Components Management
    const { data: components, mutate: mutateComponents } = useSWR(project ? listComponents(project.id) : null, fetcher)
    const [deleteCompOpen, setDeleteCompOpen] = useState(false)
    const [compToDelete, setCompToDelete] = useState<{ id: string, name: string } | null>(null)

    const handleDeleteComp = async () => {
        if (!compToDelete || !project) return
        try {
            await deleteComponent(compToDelete.id, project.id)
            toast.success(`Component ${compToDelete.name} deleted`)
            mutateComponents()
            setDeleteCompOpen(false)
            setCompToDelete(null)
        } catch (e) {
            toast.error("Failed to delete component")
        }
    }

    const [deleteEnvOpen, setDeleteEnvOpen] = useState(false)
    const [envToDelete, setEnvToDelete] = useState<string | null>(null)

    const handleDeleteEnv = async () => {
        if (!envToDelete || !project) return
        try {
            await deleteEnvironment(project.id, envToDelete)
            toast.success(`Environment ${envToDelete} deleted`)
            // Optimistic update or mutate
            setDeleteEnvOpen(false)
            setEnvToDelete(null)
            // Force reload of project data
            // mutate("/list_projects") // This is global, might need to be specific if key usage varies
            window.location.reload()
        } catch (e) {
            toast.error("Failed to delete environment")
        }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#14161A]">Project Settings</h1>
                <p className="text-muted-foreground">Manage project lifecycle.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Environments</CardTitle>
                    <CardDescription>
                        Manage environments for this project. deleting an environment will delete all associated plans.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {project?.environments?.map((env: string) => (
                        <div key={env} className="flex items-center justify-between p-3 border rounded-md bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                            <span className="font-medium font-mono text-sm">{env}</span>
                            {env !== 'dev' && ( // Prevent deleting default dev? Maybe allows it. User requested allow delete.
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => {
                                        setEnvToDelete(env)
                                        setDeleteEnvOpen(true)
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                            {env === 'dev' && <span className="text-xs text-muted-foreground italic px-3">Default</span>}
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Dialog open={deleteEnvOpen} onOpenChange={setDeleteEnvOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Environment?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <span className="font-bold">{envToDelete}</span>?
                            This will delete ALL Terraform plans associated with this environment.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteEnvOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteEnv}>Delete Environment</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle>Components</CardTitle>
                    <CardDescription>
                        Manage components tracked in this project. Deleting a component will delete all its history.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {components?.length === 0 && <div className="text-muted-foreground text-sm">No components found.</div>}
                    {components?.map((comp: any) => (
                        <div key={comp.id} className="flex items-center justify-between p-3 border rounded-md bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                            <span className="font-medium font-mono text-sm">{comp.name}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => {
                                    setCompToDelete(comp)
                                    setDeleteCompOpen(true)
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Dialog open={deleteCompOpen} onOpenChange={setDeleteCompOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Component?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <span className="font-bold">{compToDelete?.name}</span>?
                            This will delete ALL associated Terraform plan history.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteCompOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteComp}>Delete Component</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
