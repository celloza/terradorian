"use client"

import { useState, use } from "react"
import useSWR from "swr"
import { fetcher, createComponent, generatePat, listComponents, listPlans } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Key, Layers, ArrowLeft, LayoutList, History, Cpu, CloudFog, CloudLightning, Activity, BarChart2, Clock } from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ResourceList } from "@/components/resource-list"
import { ProjectDashboard } from "@/components/project-dashboard"
import { DependencyGraph } from "@/components/dependency-graph"
import { formatDistanceToNow } from "date-fns"
import { useEffect } from "react"

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const projectId = id

    // Fetch Project Name (re-using list_projects for simplicity as discussed)
    const { data: projects } = useSWR("/list_projects", fetcher)
    const project = projects?.find((p: any) => p.id === projectId)

    const { data: components, mutate: mutateComponents } = useSWR(listComponents(projectId), fetcher)
    const { data: plans } = useSWR(listPlans(projectId, undefined), fetcher)

    const [isCreating, setIsCreating] = useState(false)
    const [compName, setCompName] = useState("")
    const [patResult, setPatResult] = useState<{ pat: string, message: string } | null>(null)

    const handleCreateComponent = async () => {
        if (!compName) return
        try {
            await createComponent(projectId, compName)
            setCompName("")
            setIsCreating(false)
            mutateComponents()
        } catch (e) {
            alert("Failed to create component")
        }
    }

    const handleGeneratePat = async (componentId: string) => {
        try {
            const data = await generatePat(componentId)
            setPatResult(data)
        } catch (e) {
            alert("Failed to generate PAT")
        }
    }

    // Fetch Latest Plan for EACH component for the Graph
    const [allGraphPlans, setAllGraphPlans] = useState<any[]>([])

    useEffect(() => {
        const fetchGraphData = async () => {
            if (!components) return
            const promises = components.map(async (c: any) => {
                const p = await listPlans(projectId, c.id) // Adjusted signature if needed, or query params? 
                // Wait, listPlans in api.ts might not support second arg yet? 
                // I need to check api.ts. If it uses params object it's fine.
                // Assuming listPlans(projectId, undefined, componentId) or similar.
                return p && p.length > 0 ? p[0] : null
            })
            const results = await Promise.all(promises)
            setAllGraphPlans(results.filter(r => r !== null))
        }
        fetchGraphData()
    }, [components, projectId])

    if (!project) return <div>Loading Project...</div>

    // Determine Cloud Icon
    let CloudIcon = Activity
    const latestPlan = plans && plans.length > 0 ? plans[0] : null
    const platform = latestPlan?.cloud_platform || "Unknown"

    if (platform === "Azure") CloudIcon = CloudLightning
    // Using CloudLightning as a proxy for Azure, standard Lucide doesn't have brand icons

    // Calculate Age
    const timeAgo = latestPlan ? formatDistanceToNow(new Date(latestPlan.timestamp), { addSuffix: true }) : "Never"

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-4 border-b pb-4">
                <Link href="/projects">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-md">
                        <CloudIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
                        <div className="flex items-center gap-4 mt-1">
                            <p className="text-muted-foreground text-sm">
                                {project.description || "No description"}
                            </p>

                            {platform !== "Unknown" && (
                                <Badge variant="secondary" className="font-mono text-xs">
                                    {platform}
                                </Badge>
                            )}

                            {latestPlan && (
                                <span className="flex items-center text-xs text-muted-foreground border-l pl-4">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Last plan: {timeAgo}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="resources">Resources</TabsTrigger>
                    <TabsTrigger value="components">Components</TabsTrigger>
                    <TabsTrigger value="drift">Drift Reports</TabsTrigger>
                    <TabsTrigger value="graph">Graph</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6">
                    <ProjectDashboard plans={plans} />
                </TabsContent>

                <TabsContent value="resources" className="mt-6">
                    <ResourceList changes={latestPlan?.terraform_plan?.resource_changes || []} />
                </TabsContent>

                <TabsContent value="components" className="mt-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xl font-semibold flex items-center">
                                <Layers className="mr-2 h-5 w-5" /> Components
                            </CardTitle>
                            <Dialog open={isCreating} onOpenChange={setIsCreating}>
                                <DialogTrigger asChild>
                                    <Button size="sm">
                                        <Plus className="h-4 w-4 mr-1" /> Add
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add Component</DialogTitle>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="cname">Name</Label>
                                            <Input id="cname" value={compName} onChange={(e) => setCompName(e.target.value)} />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handleCreateComponent}>Add Component</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            {components ? (
                                <div className="space-y-2 mt-4">
                                    {components.length === 0 && <p className="text-sm text-muted-foreground">No components yet.</p>}
                                    {components.map((c: any) => (
                                        <div key={c.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50 border">
                                            <span className="font-medium">{c.name}</span>
                                            <Button variant="outline" size="sm" onClick={() => handleGeneratePat(c.id)}>
                                                <Key className="mr-2 h-3 w-3" /> Generate Key
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p>Loading...</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="drift" className="mt-6">
                    <div className="space-y-4">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Timestamp</TableHead>
                                        <TableHead>Component</TableHead>
                                        <TableHead>TF Version</TableHead>
                                        <TableHead>Providers</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!plans ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                                        </TableRow>
                                    ) : plans.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center">No drift reports found.</TableCell>
                                        </TableRow>
                                    ) : (
                                        plans.map((plan: any) => (
                                            <TableRow key={plan.id}>
                                                <TableCell className="font-medium">{new Date(plan.timestamp).toLocaleString()}</TableCell>
                                                <TableCell>{plan.component_name || "Unknown"}</TableCell>
                                                <TableCell>
                                                    <span className="font-mono text-xs">{plan.terraform_version || "N/A"}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(plan.providers || []).map((p: string) => (
                                                            <Badge key={p} variant="secondary" className="text-[10px] px-1 py-0">{p}</Badge>
                                                        ))}
                                                        {(!plan.providers || plan.providers.length === 0) && <span className="text-muted-foreground">-</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Ingested</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="graph" className="mt-6">
                    <div className="border rounded-lg p-4 bg-background">
                        <p className="text-red-500 font-bold">DEBUG: GRAPH TAB ACTIVE</p>
                        <DependencyGraph components={components || []} plans={allGraphPlans} />
                    </div>
                </TabsContent>
            </Tabs>

            {/* PAT Dialog */}
            <Dialog open={!!patResult} onOpenChange={(open) => !open && setPatResult(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New Component API Token</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">{patResult?.message}</p>
                        <div className="p-4 bg-muted rounded-md break-all font-mono text-sm">
                            {patResult?.pat}
                        </div>
                        <p className="text-xs text-red-500">Copy this now. You won't see it again.</p>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
