'use client'

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { TopNavBar } from "@/components/top-nav-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"

// Actually, looking at package.json (not visible) or other files... 
// I'll stick to simple state message for now to be safe, or just keeping the existing message approach but styled better.

interface AuthSettings {
    client_id?: string;
    client_secret?: string;
    tenant_id?: string;
}

export default function SettingsPage() {
    const { register, handleSubmit, setValue } = useForm<AuthSettings>()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        // Load current settings
        fetch('/api/settings/auth')
            .then(res => {
                if (res.ok) return res.json()
                return {}
            })
            .then((data: unknown) => {
                const settings = data as AuthSettings;
                if (settings.client_id) setValue('client_id', settings.client_id)
                // client_secret might be hidden/masked by backend in future, but for now it returns it
                if (settings.client_secret) setValue('client_secret', settings.client_secret)
                if (settings.tenant_id) setValue('tenant_id', settings.tenant_id)
                setLoading(false)
            })
            .catch(err => {
                console.error("Failed to load settings", err)
                setLoading(false)
            })
    }, [setValue])

    const onSubmit = async (data: AuthSettings) => {
        setSaving(true)

        try {
            const res = await fetch('/api/settings/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })

            if (res.ok) {
                toast.success("Settings saved successfully", {
                    description: "Changes will take effect on next login."
                })
            } else {
                toast.error("Failed to save settings", {
                    description: "Please check your inputs and try again."
                })
            }
        } catch (e) {
            toast.error("An error occurred", {
                description: "Could not connect to the server."
            })
        }

        setSaving(false)
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
            <TopNavBar />

            <div className="flex-1 container max-w-4xl mx-auto py-10 px-4">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Settings</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Manage your application configuration and authentication providers.</p>
                </div>

                <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <CardHeader>
                        <CardTitle>Microsoft Entra ID</CardTitle>
                        <CardDescription>
                            Configure Single Sign-On (SSO) with Microsoft Entra ID (formerly Azure AD).
                            Leave these fields empty to disable Entra authentication.
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <CardContent className="space-y-4">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
                                </div>
                            ) : (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="client_id">Client ID (Application ID)</Label>
                                        <Input
                                            id="client_id"
                                            placeholder="e.g., 00000000-0000-0000-0000-000000000000"
                                            {...register('client_id')}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="client_secret">Client Secret</Label>
                                        <Input
                                            id="client_secret"
                                            type="password"
                                            placeholder="Client Secret Value"
                                            {...register('client_secret')}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="tenant_id">Tenant ID</Label>
                                        <Input
                                            id="tenant_id"
                                            placeholder="e.g., 00000000-0000-0000-0000-000000000000"
                                            {...register('tenant_id')}
                                        />
                                    </div>
                                </>
                            )}
                        </CardContent>
                        <CardFooter className="flex flex-col items-start gap-4 border-t border-zinc-100 dark:border-zinc-800 pt-6">
                            <div className="flex items-center justify-between w-full">
                                <Button type="submit" disabled={loading || saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {!saving && <Save className="mr-2 h-4 w-4" />}
                                    Save Configuration
                                </Button>
                            </div>

                            {/* Toaster handles feedback now */}
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    )
}
