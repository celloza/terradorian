"use client"

import { use, useEffect, useState } from "react"
import useSWR from "swr"
import { fetcher, listComponents, listPlans } from "@/lib/api"
import { DependencyGraph } from "@/components/dependency-graph"
import { BarChart2 } from "lucide-react"

export default function GraphPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const projectId = id

    const { data: components } = useSWR(listComponents(projectId), fetcher)

    // Fetch Latest Plan for EACH component for the Graph
    const [allGraphPlans, setAllGraphPlans] = useState<any[]>([])

    useEffect(() => {
        const fetchGraphData = async () => {
            if (!components) return
            const promises = components.map(async (c: any) => {
                // Fetch latest plan for this component
                const p = await fetcher(listPlans(projectId, c.id))
                return p && p.length > 0 ? p[0] : null
            })
            const results = await Promise.all(promises)
            setAllGraphPlans(results.filter(r => r !== null))
        }
        fetchGraphData()
    }, [components, projectId])

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center space-x-2">
                <BarChart2 className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold tracking-tight">Dependency Graph</h1>
            </div>
            <p className="text-muted-foreground">
                Inferred dependencies between components based on variable references.
            </p>

            <div className="border rounded-lg p-4 bg-background shadow-sm">
                <DependencyGraph components={components || []} plans={allGraphPlans} />
            </div>
        </div>
    )
}
