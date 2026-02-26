"use client"

import { useState, use } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { fetcher, deleteEnvironment, listComponents, deleteComponent, updateProjectSettings, approveIngestion, rejectIngestion, deleteAllPlans } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, AlertTriangle, X, Bell, Mail, Slack, Layers, Wand2, Settings, Check, Loader2, History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

    // Bulk Deletion State
    const [isDeletingAll, setIsDeletingAll] = useState(false)
    const [confirmDeleteAllName, setConfirmDeleteAllName] = useState("")
    const [deleteAllLoading, setDeleteAllLoading] = useState(false)

    // Notifications State
    const [settingsLoading, setSettingsLoading] = useState(false)
    const [notifState, setNotifState] = useState<any>({
        slack: { enabled: false, webhook_url: "" },
        email: {
            enabled: false,
            recipients: [],
            schedule: { day: "Monday", time: "09:00" },
            smtp: { host: "", port: 587, username: "", password: "", secure: true }
        }
    })

    // Environment Config State
    const [envConfig, setEnvConfig] = useState<Record<string, { group: string, region: string }>>({})

    const [defaultBranch, setDefaultBranch] = useState("develop")

    // Load initial state from project
    const [loaded, setLoaded] = useState(false)
    if (project && !loaded) {
        if (project.notifications) setNotifState(project.notifications)
        if (project.environments_config) setEnvConfig(project.environments_config)
        if (project.default_branch) setDefaultBranch(project.default_branch)
        setLoaded(true)
    }

    const handleSaveGeneral = async () => {
        setSettingsLoading(true)
        try {
            await updateProjectSettings(id, { default_branch: defaultBranch })
            toast.success("General settings saved")
        } catch (e) {
            toast.error("Failed to save general settings")
        } finally {
            setSettingsLoading(false)
        }
    }

    const handleSaveEnvConfig = async () => {
        setSettingsLoading(true)
        try {
            await updateProjectSettings(id, { environments_config: envConfig })
            toast.success("Environment grouping saved")
        } catch (e) {
            toast.error("Failed to save settings")
        } finally {
            setSettingsLoading(false)
        }
    }

    const autoDiscoverGroups = () => {
        const newConfig = { ...envConfig }
        project?.environments?.forEach((env: string) => {
            if (newConfig[env]) return // Skip if already set

            // Heuristic: environment-region-instance
            const parts = env.split('-')
            if (parts.length >= 2) {
                newConfig[env] = {
                    group: parts[0], // e.g., 'production'
                    region: parts[1] // e.g., 'uks'
                }
            } else {
                newConfig[env] = { group: "default", region: "global" }
            }
        })
        setEnvConfig(newConfig)
        toast.success("Auto-discovered groups based on naming convention")
    }

    const handleSaveNotifications = async () => {
        setSettingsLoading(true)
        try {
            await updateProjectSettings(id, { notifications: notifState })
            toast.success("Notification settings saved")
        } catch (e) {
            toast.error("Failed to save settings")
        } finally {
            setSettingsLoading(false)
        }
    }

    const updateNested = (path: string[], value: any) => {
        setNotifState((prev: any) => {
            const newState = { ...prev }
            let current = newState
            for (let i = 0; i < path.length - 1; i++) {
                current[path[i]] = { ...current[path[i]] }
                current = current[path[i]]
            }
            current[path[path.length - 1]] = value
            return newState
        })
    }



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

    const handleDeleteAllPlans = async () => {
        if (!project || (confirmDeleteAllName !== "Delete All" && confirmDeleteAllName !== project.name)) return

        setDeleteAllLoading(true)
        try {
            await deleteAllPlans(id)
            toast.success("All ingestions have been completely deleted.")
            setConfirmDeleteAllName("")
            setIsDeletingAll(false)
            // Hard refresh or mutate data to clear views
            window.location.reload()
        } catch (e) {
            toast.error("Failed to delete all ingestions.")
        } finally {
            setDeleteAllLoading(false)
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

    // Pending Ingestions
    const { data: pendingIngestions, mutate: mutatePending } = useSWR(project ? () => `/list_pending_ingestions?project_id=${project.id}` : null, fetcher)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const handleApprove = async (planId: string) => {
        setActionLoading(planId)
        try {
            await approveIngestion(planId)
            toast.success("Ingestion approved!")
            mutatePending()
            mutateComponents()
        } catch (e) {
            toast.error("Failed to approve ingestion")
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async (planId: string) => {
        setActionLoading(planId)
        try {
            await rejectIngestion(planId)
            toast.success("Ingestion rejected")
            mutatePending()
        } catch (e) {
            toast.error("Failed to reject ingestion")
        } finally {
            setActionLoading(null)
        }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#14161A]">Project Settings</h1>
                <p className="text-muted-foreground">Manage project lifecycle.</p>
            </div>

            {/* General Settings Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Settings className="mr-2 h-5 w-5" /> General Settings</CardTitle>
                    <CardDescription>Configure project-wide defaults.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="default-branch">Default Branch</Label>
                        <Input
                            id="default-branch"
                            placeholder="e.g. main or develop"
                            value={defaultBranch}
                            onChange={(e) => setDefaultBranch(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">The branch used by default for viewing and comparing Terraform plans.</p>
                    </div>

                    <Button onClick={handleSaveGeneral} disabled={settingsLoading}>
                        {settingsLoading ? "Saving..." : "Save Changes"}
                    </Button>
                </CardContent>
            </Card>

            {/* Notifications Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Bell className="mr-2 h-5 w-5" /> Notifications</CardTitle>
                    <CardDescription>Configure tactical alerts and strategic reports.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Slack Section */}
                    <div className="space-y-4 border-b pb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Slack className="h-5 w-5 text-zinc-500" />
                                <Label htmlFor="slack-enabled" className="text-base font-medium">Slack Alerts</Label>
                            </div>
                            <Switch
                                id="slack-enabled"
                                checked={notifState.slack.enabled}
                                onCheckedChange={(c) => updateNested(['slack', 'enabled'], c)}
                            />
                        </div>
                        {notifState.slack.enabled && (
                            <div className="ml-7 space-y-2">
                                <Label>Webhook URL</Label>
                                <Input
                                    placeholder="https://hooks.slack.com/services/..."
                                    value={notifState.slack.webhook_url || ""}
                                    onChange={(e) => updateNested(['slack', 'webhook_url'], e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">Alerts will be sent here when drift is detected.</p>
                            </div>
                        )}
                    </div>

                    {/* Email Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Mail className="h-5 w-5 text-zinc-500" />
                                <Label htmlFor="email-enabled" className="text-base font-medium">Email Reports</Label>
                            </div>
                            <Switch
                                id="email-enabled"
                                checked={notifState.email.enabled}
                                onCheckedChange={(c) => updateNested(['email', 'enabled'], c)}
                            />
                        </div>

                        {notifState.email.enabled && (
                            <div className="ml-7 space-y-6">
                                <div className="space-y-2">
                                    <Label>Recipients (Comma separated)</Label>
                                    <Input
                                        placeholder="user@example.com, team@example.com"
                                        value={notifState.email.recipients.join(", ")}
                                        onChange={(e) => updateNested(['email', 'recipients'], e.target.value.split(",").map(s => s.trim()))}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Report Day</Label>
                                        <Select
                                            value={notifState.email.schedule.day}
                                            onValueChange={(v) => updateNested(['email', 'schedule', 'day'], v)}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => (
                                                    <SelectItem key={d} value={d}>{d}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Time (UTC)</Label>
                                        <Select
                                            value={notifState.email.schedule.time}
                                            onValueChange={(v) => updateNested(['email', 'schedule', 'time'], v)}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {Array.from({ length: 24 }).map((_, i) => {
                                                    const t = `${i.toString().padStart(2, '0')}:00`
                                                    return <SelectItem key={t} value={t}>{t}</SelectItem>
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-2 border-t">
                                    <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">SMTP Settings</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Host</Label>
                                            <Input
                                                placeholder="smtp.example.com"
                                                value={notifState.email.smtp.host}
                                                onChange={(e) => updateNested(['email', 'smtp', 'host'], e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Port</Label>
                                            <Input
                                                placeholder="587"
                                                value={notifState.email.smtp.port}
                                                onChange={(e) => updateNested(['email', 'smtp', 'port'], parseInt(e.target.value) || 587)}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Username</Label>
                                            <Input
                                                value={notifState.email.smtp.username}
                                                onChange={(e) => updateNested(['email', 'smtp', 'username'], e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Password</Label>
                                            <Input
                                                type="password"
                                                value={notifState.email.smtp.password}
                                                onChange={(e) => updateNested(['email', 'smtp', 'password'], e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <Button onClick={handleSaveNotifications} disabled={settingsLoading}>
                        {settingsLoading ? "Saving..." : "Save Changes"}
                    </Button>
                </CardContent>
            </Card>

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

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Layers className="mr-2 h-5 w-5" /> Environment Grouping</CardTitle>
                    <CardDescription>
                        Group environments to enable the hierarchical overview map.
                        Use "Auto-Discover" to guess based on 'env-region-instance' naming.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={autoDiscoverGroups}>
                            <Wand2 className="mr-2 h-4 w-4" /> Auto-Discover
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {project?.environments?.map((env: string) => (
                            <div key={env} className="grid grid-cols-12 gap-4 items-center p-3 border rounded-md bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                                <div className="col-span-4 font-mono text-sm font-medium truncate" title={env}>{env}</div>
                                <div className="col-span-4">
                                    <Input
                                        placeholder="Group (e.g. Production)"
                                        className="h-8 text-xs"
                                        value={envConfig[env]?.group || ""}
                                        onChange={(e) => setEnvConfig(prev => ({
                                            ...prev,
                                            [env]: { ...prev[env], group: e.target.value, region: prev[env]?.region || "" }
                                        }))}
                                    />
                                </div>
                                <div className="col-span-4">
                                    <Input
                                        placeholder="Region (e.g. UK South)"
                                        className="h-8 text-xs"
                                        value={envConfig[env]?.region || ""}
                                        onChange={(e) => setEnvConfig(prev => ({
                                            ...prev,
                                            [env]: { ...prev[env], region: e.target.value, group: prev[env]?.group || "" }
                                        }))}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <Button onClick={handleSaveEnvConfig} disabled={settingsLoading}>
                        {settingsLoading ? "Saving..." : "Save Grouping"}
                    </Button>
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

            {/* Pending Ingestions Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5" /> Pending Ingestions</CardTitle>
                    <CardDescription>
                        Review Terraform plans uploaded for environments or components that do not exist yet.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!pendingIngestions ? (
                        <div className="text-sm text-muted-foreground">Loading...</div>
                    ) : pendingIngestions.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No pending ingestions.</div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                                        <TableHead>Environment</TableHead>
                                        <TableHead>Component</TableHead>
                                        <TableHead>Branch</TableHead>
                                        <TableHead>Timestamp</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingIngestions.map((plan: any) => {
                                        const isUnknownEnv = !project?.environments?.includes(plan.environment)
                                        const isUnknownComp = !components?.some((c: any) => c.name === plan.component_name)

                                        return (
                                            <TableRow key={plan.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm">{plan.environment}</span>
                                                        {isUnknownEnv && <Badge variant="destructive" className="text-[10px] h-4 leading-3">New</Badge>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm">{plan.component_name}</span>
                                                        {isUnknownComp && <Badge variant="destructive" className="text-[10px] h-4 leading-3">New</Badge>}
                                                    </div>
                                                </TableCell>
                                                <TableCell><Badge variant="outline" className="font-mono text-xs">{plan.branch}</Badge></TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{new Date(plan.timestamp).toLocaleString()}</TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        onClick={() => handleApprove(plan.id)}
                                                        disabled={actionLoading === plan.id}
                                                    >
                                                        {actionLoading === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => handleReject(plan.id)}
                                                        disabled={actionLoading === plan.id}
                                                    >
                                                        {actionLoading === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
                                                        Reject
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

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
                    <div className="flex items-center justify-between border-b border-red-200/50 pb-4 mb-4">
                        <div>
                            <h4 className="font-medium text-red-900">Delete All Ingestions</h4>
                            <p className="text-sm text-red-700/70">
                                Permanently wipe out all Terraform plans and blob payloads attached to this project.
                            </p>
                        </div>
                        <Button variant="destructive" onClick={() => setIsDeletingAll(true)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete All Plans
                        </Button>
                    </div>

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

            {/* Delete All Ingestions Confirmation Modal */}
            <Dialog open={isDeletingAll} onOpenChange={(open) => {
                if (!open) setConfirmDeleteAllName("")
                setIsDeletingAll(open)
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Wipe out all plan history?</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. This will permanently trace back and delete every single Terraform plan document and its JSON payload for the project
                            <span className="font-semibold text-foreground mx-1">{project?.name}</span>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <Label>Type <span className="font-mono text-xs border rounded px-1.5 py-0.5 bg-zinc-100">Delete All</span> or the project name to confirm</Label>
                        <Input
                            value={confirmDeleteAllName}
                            onChange={(e) => setConfirmDeleteAllName(e.target.value)}
                            placeholder="Delete All"
                            className="font-mono bg-red-50"
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeletingAll(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteAllPlans}
                            disabled={!project || (confirmDeleteAllName !== "Delete All" && confirmDeleteAllName !== project.name) || deleteAllLoading}
                        >
                            {deleteAllLoading ? "Deleting..." : "I understand, delete everything"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
