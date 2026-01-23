"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import useSWR from "swr"
import { fetcher } from "@/lib/api"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronsUpDown, Check, FolderKanban, PlusCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export function ProjectSwitcher() {
    const params = useParams()
    const router = useRouter()
    const currentProjectId = params.id as string

    const { data: projects } = useSWR("/list_projects", fetcher)

    const activeProject = projects?.find((p: any) => p.id === currentProjectId)

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" role="combobox" className="w-[200px] justify-between text-white hover:bg-zinc-800 hover:text-white">
                    {activeProject ? (
                        <span className="flex items-center gap-2 truncate">
                            <FolderKanban className="h-4 w-4" />
                            {activeProject.name}
                        </span>
                    ) : (
                        "Select Project..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] bg-zinc-900 text-white border-zinc-800">
                <DropdownMenuLabel>Projects</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-800" />
                {projects?.map((project: any) => (
                    <DropdownMenuItem
                        key={project.id}
                        onSelect={() => router.push(`/p/${project.id}/dashboard`)}
                        className="flex items-center justify-between hover:bg-zinc-800 cursor-pointer text-zinc-300 focus:bg-zinc-800 focus:text-white"
                    >
                        <span className="truncate">{project.name}</span>
                        {project.id === currentProjectId && <Check className="h-4 w-4 text-white" />}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                    onSelect={() => router.push("/projects")}
                    className="flex items-center gap-2 hover:bg-zinc-800 cursor-pointer text-zinc-300 focus:bg-zinc-800 focus:text-white"
                >
                    <PlusCircle className="h-4 w-4" />
                    Manage Projects
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
