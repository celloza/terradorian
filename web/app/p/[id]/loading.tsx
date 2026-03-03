import { Skeleton } from "@/components/ui/skeleton"

export default function ProjectDetailsLoading() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <Skeleton className="h-10 w-48" />
                <div className="flex items-center space-x-2">
                    <Skeleton className="h-9 w-[200px]" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b pb-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-24" />
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Skeleton className="col-span-4 h-[400px]" />
                    <Skeleton className="col-span-3 h-[400px]" />
                </div>
            </div>
        </div>
    )
}
