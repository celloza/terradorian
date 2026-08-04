import { Skeleton } from "@/components/ui/skeleton"

export default function CompareLoading() {
    return (
        <div className="p-6 space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-[620px]" />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-xl border bg-card p-6 space-y-4">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-4 w-72" />
                    <div className="grid grid-cols-2 gap-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <Skeleton className="h-56 w-full" />
                </div>

                <div className="rounded-xl border bg-card p-6 space-y-4">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-4 w-72" />
                    <div className="grid grid-cols-2 gap-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <Skeleton className="h-56 w-full" />
                </div>
            </div>

            <div className="rounded-xl border bg-card p-6 space-y-4">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-4 w-96" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
                <Skeleton className="h-72 w-full" />
            </div>
        </div>
    )
}
