import { Skeleton } from "@/components/ui/skeleton"

export default function ExploreLoading() {
    return (
        <div className="p-6 h-full flex flex-col space-y-6">
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <div className="flex items-center gap-4">
                    <Skeleton className="h-8 w-36" />
                    <Skeleton className="h-8 w-40" />
                </div>
            </div>

            <div className="flex-1 bg-white rounded-lg border shadow-sm p-6 overflow-auto space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-5/6" />
                <Skeleton className="h-8 w-3/4" />
            </div>
        </div>
    )
}
