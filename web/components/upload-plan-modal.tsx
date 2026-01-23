"use client"
import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import { fetcher, listComponents, manualIngest } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { UploadCloud, FileJson, Loader2 } from "lucide-react"

interface UploadPlanModalProps {
    isOpen: boolean
    onChange: (open: boolean) => void
    onUploadComplete?: () => void
}

export function UploadPlanModal({ isOpen, onChange, onUploadComplete }: UploadPlanModalProps) {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const projectId = params.id as string
    const currentEnv = searchParams.get("env") || "dev"

    const [isLoading, setIsLoading] = useState(false)

    // Form State
    const [selectedComponent, setSelectedComponent] = useState("")
    const [selectedEnv, setSelectedEnv] = useState(currentEnv)
    const [file, setFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    // Reset env when modal opens or URL changes
    useEffect(() => {
        if (isOpen) {
            setSelectedEnv(currentEnv)
        }
    }, [isOpen, currentEnv])

    // Data Load
    const { data: components } = useSWR(projectId ? listComponents(projectId) : null, fetcher)
    const { data: projects } = useSWR("/list_projects", fetcher)
    const project = projects?.find((p: any) => p.id === projectId)
    const environments = project?.environments || ["dev"]

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        if (e.dataTransfer.files?.[0]) {
            setFile(e.dataTransfer.files[0])
        }
    }

    const handleUpload = async () => {
        if (!selectedComponent || !selectedEnv || !file) return

        setIsLoading(true)
        try {
            const text = await file.text()
            const json = JSON.parse(text)

            await manualIngest(selectedComponent, selectedEnv, json)

            onChange(false)
            setFile(null)

            // If uploaded to a different env, switch to it
            if (selectedEnv !== currentEnv) {
                router.push(`/p/${projectId}/dashboard?env=${selectedEnv}`)
            } else {
                if (onUploadComplete) onUploadComplete()
            }
        } catch (e) {
            alert("Failed to upload plan: " + e)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Upload Terraform Plan</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">

                    {/* Component Select */}
                    <div className="grid gap-2">
                        <Label>Component</Label>
                        <Select value={selectedComponent} onValueChange={setSelectedComponent}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select component..." />
                            </SelectTrigger>
                            <SelectContent>
                                {components?.map((c: any) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Environment Select */}
                    <div className="grid gap-2">
                        <Label>Environment</Label>
                        <Select value={selectedEnv} onValueChange={setSelectedEnv}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select environment..." />
                            </SelectTrigger>
                            <SelectContent>
                                {environments.map((env: string) => (
                                    <SelectItem key={env} value={env}>{env}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* File Drop/Input */}
                    <div className="grid gap-2">
                        <Label>Plan JSON File</Label>
                        <div className="flex items-center justify-center w-full">
                            <label
                                htmlFor="dropzone-file"
                                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? "border-blue-500 bg-blue-50/50" : "bg-muted hover:bg-muted/70"}`}
                                onDragOver={handleDragOver}
                                onDragEnter={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    {file ? (
                                        <>
                                            <FileJson className="w-8 h-8 text-blue-500 mb-2" />
                                            <p className="text-sm text-center font-medium">{file.name}</p>
                                            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                                        </>
                                    ) : (
                                        <>
                                            <UploadCloud className="w-8 h-8 text-muted-foreground mb-2" />
                                            <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                                            <p className="text-xs text-muted-foreground">JSON files only</p>
                                        </>
                                    )}
                                </div>
                                <input id="dropzone-file" type="file" className="hidden" accept=".json" onChange={handleFileChange} />
                            </label>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleUpload} disabled={isLoading || !selectedComponent || !selectedEnv || !file}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isLoading ? "Uploading..." : "Upload Plan"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

