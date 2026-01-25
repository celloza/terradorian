"use client"
import { toast } from "sonner"

import { useState } from "react"
import useSWR from "swr"
import { fetcher, createProject } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, FolderOpen } from "lucide-react"
import Link from "next/link"
import { TopNavBar } from "@/components/top-nav-bar"
import { TerradorianLogo } from "@/components/terradorian-logo"

// ... imports

export default function ProjectsPage() {

    const { data: projects, error, mutate } = useSWR("/list_projects", fetcher)
    const [isOpen, setIsOpen] = useState(false)
    const [newProjectName, setNewProjectName] = useState("")
    const [newProjectDesc, setNewProjectDesc] = useState("")

    const handleCreate = async () => {
        if (!newProjectName) return
        try {
            await createProject(newProjectName, newProjectDesc)
            setIsOpen(false)
            setNewProjectName("")
            setNewProjectDesc("")
            mutate()
        } catch (e) {
            toast.error("Failed to create project")
        }
    }

    if (error) return <div>Failed to load</div>
    if (!projects) return <div>Loading...</div>

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
            <TopNavBar />

            <div className="flex flex-col items-center justify-center p-4 flex-1">
                <div className="w-full max-w-5xl space-y-8">
                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-6">
                            <div className="relative w-24 h-24">
                                <TerradorianLogo />
                            </div>
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-zinc-900 dark:text-zinc-50">Welcome to Terradorian</h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            Select a project to view its drift status, or create a new one to get started.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Dialog open={isOpen} onOpenChange={setIsOpen}>
                            <DialogTrigger asChild>
                                <Button size="lg" className="shadow-md">
                                    <Plus className="mr-2 h-5 w-5" /> New Project
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create Project</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Name</Label>
                                        <Input id="name" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="desc">Description</Label>
                                        <Input id="desc" value={newProjectDesc} onChange={(e) => setNewProjectDesc(e.target.value)} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleCreate}>Create</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className={`grid gap-6 ${projects.length === 1 ? 'max-w-md mx-auto grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
                        {projects.map((project: any) => (
                            <Link href={`/p/${project.id}/dashboard`} key={project.id} className="group">
                                <Card className="hover:shadow-lg transition-all cursor-pointer h-full border-zinc-200 dark:border-zinc-800 group-hover:border-blue-500/50">
                                    <CardHeader>
                                        <CardTitle className="group-hover:text-blue-600 transition-colors">{project.name}</CardTitle>
                                        <CardDescription>{project.description || "No description"}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center text-sm text-muted-foreground group-hover:text-zinc-900 transition-colors">
                                            <FolderOpen className="mr-2 h-4 w-4" /> Open Dashboard
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                        {projects.length === 0 && (
                            <div className="col-span-full text-center p-12 border-2 border-dashed rounded-xl bg-muted/50">
                                <p className="text-muted-foreground">No projects found.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
