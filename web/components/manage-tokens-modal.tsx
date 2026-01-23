import { useState } from "react"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { fetcher, generatePat, listTokens, revokeToken } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Key, Copy, Check, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface ManageTokensModalProps {
    isOpen: boolean
    onChange: (open: boolean) => void
}

export function ManageTokensModal({ isOpen, onChange }: ManageTokensModalProps) {
    const params = useParams()
    const projectId = params.id as string

    // Fetch existing tokens
    const { data: tokens, mutate } = useSWR(isOpen ? listTokens(projectId) : null, fetcher)

    const [patResult, setPatResult] = useState<{ pat: string, message: string } | null>(null)
    const [copied, setCopied] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isRevoking, setIsRevoking] = useState<string | null>(null)

    const handleGenerate = async () => {
        setIsLoading(true)
        try {
            const data = await generatePat(projectId)
            setPatResult(data)
            mutate() // Refresh list
            setCopied(false)
        } catch (e) {
            alert("Failed to generate token")
        } finally {
            setIsLoading(false)
        }
    }

    const handleRevoke = async (tokenId: string) => {
        if (!confirm("Are you sure you want to revoke this token? Any CLI/CI using it will stop working.")) return;
        setIsRevoking(tokenId)
        try {
            await revokeToken(projectId, tokenId)
            mutate()
        } catch (e) {
            alert("Failed to revoke token")
        } finally {
            setIsRevoking(null)
        }
    }

    const copyToClipboard = () => {
        if (patResult?.pat) {
            navigator.clipboard.writeText(patResult.pat)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const reset = () => {
        setPatResult(null)
        setCopied(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) reset()
            onChange(open)
        }}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>API Access Tokens</DialogTitle>
                    <DialogDescription>Manage tokens for CLI/CI ingestion.</DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* New Token Result */}
                    {patResult && (
                        <div className="space-y-4 p-4 border rounded-md bg-green-50/50">
                            <div className="p-3 bg-green-100 text-green-900 text-sm rounded flex items-center gap-2">
                                <Check className="h-4 w-4" /> Token Generated
                            </div>
                            <div className="relative group">
                                <pre className="p-4 bg-zinc-950 text-green-400 rounded-md whitespace-pre-wrap break-all font-mono text-xs border border-zinc-800 w-full">
                                    {patResult.pat}
                                </pre>
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    className="absolute top-2 right-2 h-6 w-6"
                                    onClick={copyToClipboard}
                                >
                                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </Button>
                            </div>
                            <div className="text-xs text-muted-foreground text-center">
                                Store this token safely. It won't be shown again.
                            </div>
                            <Button variant="outline" size="sm" onClick={reset} className="w-full">
                                Done
                            </Button>
                        </div>
                    )}

                    {/* Generate Button (Validation: Only show if not displaying result) */}
                    {!patResult && (
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                                Tokens grant full write access to this project.
                            </p>
                            <Button className="w-full" onClick={handleGenerate} disabled={isLoading}>
                                <Key className="mr-2 h-4 w-4" /> Generate New Token
                            </Button>
                        </div>
                    )}

                    {/* Token List */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium">Active Tokens ({tokens?.length || 0})</h4>
                        <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
                            {!tokens ? (
                                <div className="p-4 text-center text-xs text-muted-foreground">Loading tokens...</div>
                            ) : tokens.length === 0 ? (
                                <div className="p-4 text-center text-xs text-muted-foreground">No active tokens found.</div>
                            ) : (
                                tokens.map((t: any) => (
                                    <div key={t.id} className="flex items-center justify-between p-3 text-sm">
                                        <div className="space-y-0.5">
                                            <div className="font-mono text-xs bg-zinc-100 px-2 py-0.5 rounded w-fit">
                                                {t.prefix}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Created {t.created_at ? formatDistanceToNow(new Date(t.created_at), { addSuffix: true }) : "Unknown"}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50"
                                            onClick={() => handleRevoke(t.id)}
                                            disabled={isRevoking === t.id}
                                        >
                                            {isRevoking === t.id ? <div className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" /> : <Trash2 className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
