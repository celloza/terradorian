"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR, { mutate } from "swr"
import { fetcher, createProject } from "@/lib/api"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FolderKanban, Plus, ArrowRight, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

export default function ProjectsPage() {
    const { data: projects, error, isLoading } = useSWR("/list_projects", fetcher)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newProjectName, setNewProjectName] = useState("")
    const [newProjectDesc, setNewProjectDesc] = useState("")
    const [isCreating, setIsCreating] = useState(false)

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newProjectName.trim()) return

        setIsCreating(true)
        try {
            await createProject(newProjectName, newProjectDesc)
            toast.success("Project created successfully")
            mutate("/list_projects")
            setIsCreateOpen(false)
            setNewProjectName("")
            setNewProjectDesc("")
        } catch (err) {
            toast.error("Failed to create project")
            console.error(err)
        } finally {
            setIsCreating(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4">
                <p className="text-red-500">Failed to load projects.</p>
                <Button onClick={() => mutate("/list_projects")}>Retry</Button>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-10 px-4 max-w-5xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Projects</h1>
                    <p className="text-muted-foreground">Manage your infrastructure projects and environments.</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            New Project
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Project</DialogTitle>
                            <DialogDescription>
                                Create a new project to organize your Terraform state and plans.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateProject} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Project Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g., e-commerce-platform"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="desc">Description (Optional)</Label>
                                <Input
                                    id="desc"
                                    placeholder="Main infrastructure for online store"
                                    value={newProjectDesc}
                                    onChange={(e) => setNewProjectDesc(e.target.value)}
                                />
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isCreating || !newProjectName.trim()}>
                                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Create Project
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {projects?.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center bg-muted/10">
                    <FolderKanban className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
                    <h3 className="text-lg font-medium">No projects found</h3>
                    <p className="text-muted-foreground mb-4 max-w-sm">
                        Get started by creating your first project to manage infrastructure.
                    </p>
                    <Button onClick={() => setIsCreateOpen(true)}>Create Project</Button>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {projects?.map((project: any) => (
                        <Card key={project.id} className="flex flex-col hover:border-primary/50 transition-colors">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span className="truncate">{project.name}</span>
                                </CardTitle>
                                <CardDescription className="line-clamp-2 min-h-[40px]">
                                    {project.description || "No description provided."}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1">
                                <div className="text-sm text-muted-foreground">
                                    <div className="flex justify-between py-1 border-b border-border/50">
                                        <span>Created</span>
                                        <span>{new Date(project.created_at || Date.now()).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex justify-between py-1 pt-2">
                                        <span>Environments</span>
                                        <span>{project.environments?.length || 0}</span>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button asChild className="w-full" variant="secondary">
                                    <Link href={`/p/${project.id}/dashboard`}>
                                        View Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
