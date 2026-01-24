'use client'

import { signIn } from "next-auth/react"
import { useState, Suspense, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { TerradorianLogo } from "@/components/terradorian-logo"
import { Github } from "lucide-react"

function LoginContent() {
    const searchParams = useSearchParams()
    const callbackUrl = searchParams.get('callbackUrl') || '/'
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')

    const [error, setError] = useState('')
    const [showEntra, setShowEntra] = useState(false)
    const { push } = useRouter()

    useEffect(() => {
        // Fetch settings on mount
        fetch('/api/settings/auth')
            .then(res => res.json())
            .then(data => {
                if (data.client_id && data.tenant_id) {
                    setShowEntra(true)
                }
            })
            .catch(err => console.error("Failed to check auth settings", err))
    }, [])

    const handleOwnerLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        try {
            const res = await signIn("credentials", {
                username,
                password,
                redirect: false,
            })

            if (res?.error) {
                if (res.error === "CredentialsSignin") {
                    setError("Invalid username or password")
                } else {
                    setError("Login failed. Please try again.")
                }
                return
            }

            if (res?.ok) {
                push(callbackUrl)
            } else {
                setError("Login failed with unknown error")
            }
        } catch (err: any) {
            setError("Something went wrong. Please try again.")
            console.error(err)
        }
    }

    const handleEntraLogin = async () => {
        await signIn("microsoft-entra-id", { callbackUrl })
    }

    return (
        <div className="w-full max-w-md">
            <div className="p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
                <div className="flex justify-center mb-4">
                    <div className="relative w-16 h-16">
                        <TerradorianLogo />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-center">Login to terradorian</h1>

                <form onSubmit={handleOwnerLogin} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded text-sm text-red-500 text-center">
                            {error}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2 mt-1 bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 mt-1 bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-2 font-bold text-white bg-blue-600 rounded hover:bg-blue-700"
                    >
                        Login
                    </button>
                </form>

                {showEntra && (
                    <>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-600"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-gray-800 text-gray-400">Or continue with</span>
                            </div>
                        </div>

                        <button
                            onClick={handleEntraLogin}
                            className="w-full py-2 font-bold text-white bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 0C4.477 0 0 4.477 0 10c0 5.523 4.477 10 10 10s10-4.477 10-10C20 4.477 15.523 0 10 0z" />
                            </svg>
                            Microsoft Entra ID
                        </button>
                    </>
                )}
            </div>

            <div className="mt-8 text-center">
                <a
                    href="https://github.com/celloza/terradorian"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                    <Github className="w-4 h-4" />
                    <span>View on GitHub</span>
                </a>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
            <Suspense fallback={<div>Loading...</div>}>
                <LoginContent />
            </Suspense>
        </div>
    )
}
