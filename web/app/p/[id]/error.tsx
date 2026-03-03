"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function ProjectError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Optionally log the error to an error reporting service
        console.error(error)
    }, [error])

    return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-background">
            <h2 className="text-xl font-bold">Failed to load project data</h2>
            <p className="text-muted-foreground">{error.message}</p>
            <Button onClick={() => reset()}>Try again</Button>
        </div>
    )
}
