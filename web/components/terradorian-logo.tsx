"use client"

import { cn } from "@/lib/utils"
import Image from "next/image"

export function TerradorianLogo({ className }: { className?: string }) {
    return (
        <object
            type="image/svg+xml"
            data="/terradorian-logo.svg"
            className={cn("w-full h-full pointer-events-none", className)}
            aria-label="Terradorian Logo"
        />
    )
}
