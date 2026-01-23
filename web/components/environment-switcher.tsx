"use client"

import { useState } from "react"
import { useRouter, useSearchParams, usePathname, useParams } from "next/navigation"
import useSWR from "swr"
import { fetcher, addEnvironment } from "@/lib/api"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { ChevronsUpDown, Check, Container, Plus } from "lucide-react"

export function EnvironmentSwitcher() {
    const params = useParams()
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const projectId = params.id as string
    const currentEnv = searchParams.get("env") || "dev"

    const { data: projects, mutate } = useSWR("/list_projects", fetcher)
    const project = projects?.find((p: any) => p.id === projectId)

    // Default to ['dev'] if not loaded or empty (should always have at least dev)
    const environments = project?.environments || ["dev"]

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [newEnvName, setNewEnvName] = useState("")

    const handleSelect = (env: string) => {
        const newParams = new URLSearchParams(searchParams.toString())
        newParams.set("env", env)
        router.push(`${pathname}?${newParams.toString()}`)
    }

    const handleCreateEnv = async () => {
        if (!newEnvName) return
        try {
            await addEnvironment(projectId, newEnvName)
            setNewEnvName("")
            setIsDialogOpen(false)
            mutate() // Refresh projects list to show new env
            handleSelect(newEnvName) // Switch to it
        } catch (e) {
            alert("Failed to add environment")
        }
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-[160px] justify-between text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-700 bg-zinc-900/50">
                        <span className="flex items-center gap-2 truncate">
                            <Container className="h-3 w-3" />
                            <span className="text-xs">{currentEnv}</span>
                        </span>
                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[200px] bg-zinc-900 text-white border-zinc-800">
                    <DropdownMenuLabel>Environment</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-zinc-800" />
                    {environments.map((env: string) => (
                        <DropdownMenuItem
                            key={env}
                            onSelect={() => handleSelect(env)}
                            className="flex items-center justify-between hover:bg-zinc-800 cursor-pointer text-zinc-300 focus:bg-zinc-800 focus:text-white text-xs"
                        >
                            <span>{env}</span>
                            {env === currentEnv && <Check className="h-3 w-3 text-white" />}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="bg-zinc-800" />
                    <DialogTrigger asChild>
                        <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()} // Prevent closing dropdown immediately
                            className="flex items-center gap-2 hover:bg-zinc-800 cursor-pointer text-zinc-300 focus:bg-zinc-800 focus:text-white text-xs"
                        >
                            <Plus className="h-3 w-3" />
                            <span>Add Environment...</span>
                        </DropdownMenuItem>
                    </DialogTrigger>
                </DropdownMenuContent>
            </DropdownMenu>

            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Environment</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <Input
                        placeholder="e.g. staging, prod, user-test"
                        value={newEnvName}
                        onChange={(e) => setNewEnvName(e.target.value)}
                    />
                </div>
                <DialogFooter>
                    <Button onClick={handleCreateEnv}>Create & Switch</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
