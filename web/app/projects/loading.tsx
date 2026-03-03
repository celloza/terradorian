import Image from "next/image"
import { Skeleton } from "@/components/ui/skeleton"
import packageJson from "../../package.json"

export default function ProjectsLoading() {
    return (
        <div className="flex flex-col min-h-screen bg-background">
            <main className="container mx-auto py-10 px-4 max-w-5xl flex-1 flex flex-col">

                {/* Hero Section Skeleton */}
                <div className="flex flex-col items-center justify-center text-center mt-8 mb-16">
                    <Image
                        src="/terradorian-logo.svg"
                        alt="Terradorian Logo"
                        width={96}
                        height={96}
                        className="mb-8 opacity-50 grayscale"
                        priority
                    />
                    <Skeleton className="h-12 w-64 mb-4" />
                    <Skeleton className="h-6 w-full max-w-2xl" />
                </div>

                <div className="flex items-center justify-between mb-8 border-b pb-4">
                    <Skeleton className="h-8 w-40" />
                    <Skeleton className="h-10 w-32" />
                </div>

                {/* Grid Skeleton */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex flex-col border border-border/50 rounded-xl p-6 shadow-sm">
                            <Skeleton className="h-6 w-3/4 mb-2" />
                            <Skeleton className="h-4 w-full mb-1" />
                            <Skeleton className="h-4 w-2/3 mb-6" />

                            <div className="space-y-3 flex-1">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                            </div>

                            <Skeleton className="h-10 w-full mt-6" />
                        </div>
                    ))}
                </div>
            </main>

            <footer className="w-full border-t border-border/50 py-6 mt-12 text-center text-sm text-muted-foreground bg-muted/10">
                Terradorian v{packageJson.version}
            </footer>
        </div>
    )
}
