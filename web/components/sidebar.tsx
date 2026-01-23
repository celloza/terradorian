"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
// 1. Import the Image component
import Image from "next/image"
import { TerradorianLogo } from "@/components/terradorian-logo"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, FolderKanban } from "lucide-react"

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <div className={cn("pb-12 w-64 border-r min-h-screen bg-black text-white", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-6 px-4 text-lg font-bold tracking-tight text-white flex items-center gap-3">
            <div className="relative w-8 h-8">
              <TerradorianLogo />
            </div>
            terradorian
          </h2>
          <div className="space-y-1">
            <Link href="/projects">
              <Button variant="ghost" className={cn("w-full justify-start hover:bg-zinc-800 hover:text-white", pathname.startsWith("/projects") ? "bg-zinc-800 text-white font-medium" : "text-zinc-400")}>
                <FolderKanban className="mr-2 h-4 w-4" />
                Projects
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}