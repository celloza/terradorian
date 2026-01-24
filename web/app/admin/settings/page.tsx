'use client'

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"

// Authenticated by middleware (must be admin/owner)

interface AuthSettings {
    client_id?: string;
    client_secret?: string;
    tenant_id?: string;
}

export default function SettingsPage() {
    const { register, handleSubmit, setValue } = useForm()
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState('')

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
                if (settings.client_secret) setValue('client_secret', settings.client_secret) // Might be empty/hidden
                if (settings.tenant_id) setValue('tenant_id', settings.tenant_id)
                setLoading(false)
            })
    }, [setValue])

    const onSubmit = async (data: any) => {
        setLoading(true)
        const res = await fetch('/api/settings/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        if (res.ok) {
            setMessage("Settings saved! Restart might be required implicitly if logic depended on startup, but ours is dynamic.")
        } else {
            setMessage("Error saving settings.")
        }
        setLoading(false)
    }

    if (loading) return <div className="p-8">Loading settings...</div>

    return (
        <div className="p-8 max-w-2xl mx-auto text-white">
            <h1 className="text-3xl font-bold mb-6">Authentication Settings</h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-gray-800 p-6 rounded-lg shadow">

                <h2 className="text-xl font-semibold mb-4 border-b border-gray-600 pb-2">Microsoft Entra ID</h2>

                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Client ID (Application ID)</label>
                        <input
                            {...register('client_id')}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Client Secret</label>
                        <input
                            type="password"
                            {...register('client_secret')}
                            placeholder="Overwrite to change..."
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Tenant ID</label>
                        <input
                            {...register('tenant_id')}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold transition-colors disabled:opacity-50"
                    >
                        Save Configuration
                    </button>
                </div>

                {message && <p className="mt-4 text-green-400">{message}</p>}
            </form>
        </div>
    )
}
