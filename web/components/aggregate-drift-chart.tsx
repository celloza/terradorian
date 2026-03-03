"use client"

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts"
import { useMemo } from "react"
import { useTheme } from "next-themes"

// Helper to generate distinct colors for up to 10 groups
const COLORS = [
    "#3b82f6", // blue-500
    "#10b981", // emerald-500
    "#f59e0b", // amber-500
    "#ef4444", // red-500
    "#8b5cf6", // violet-500
    "#ec4899", // pink-500
    "#14b8a6", // teal-500
    "#f97316", // orange-500
    "#6366f1", // indigo-500
    "#84cc16", // lime-500
]

export function AggregateDriftChart({ groups }: { groups: { name: string, plans: any[] }[] }) {
    const { theme } = useTheme()

    // We want a unified timeline.
    const data = useMemo(() => {
        if (!groups || groups.length === 0) return [];

        // 1. Gather all unique timestamps across all plans in all groups
        const allPlans = groups.flatMap(g => g.plans);
        const uniqueTimestamps = Array.from(new Set(allPlans.map(p => p.timestamp))).sort((a: any, b: any) => new Date(a).getTime() - new Date(b).getTime());

        // 2. Track latest state per component per group
        // Map: GroupName -> Map(ComponentId -> stats)
        const groupStates = new Map<string, Map<string, { total: number }>>();
        groups.forEach(g => groupStates.set(g.name, new Map()));

        // Helper to calc stats
        const getPlanTotal = (plan: any) => {
            const changes = plan.terraform_plan?.resource_changes || []
            let total = 0
            changes.forEach((rc: any) => {
                const actions = rc.change.actions
                if (actions.includes("create") || actions.includes("delete") || actions.includes("update")) {
                    total++
                }
            })
            return total
        }

        // 3. For each timestamp, we must accumulate the state of all components up to this point.
        const sortedGroupPlans = groups.map(g => ({
            name: g.name,
            plans: [...g.plans].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        }));

        const timeSeriesData = uniqueTimestamps.map(timestamp => {
            const dataPoint: any = {
                timestamp,
                date: new Date(timestamp as string).toLocaleDateString(),
            };

            sortedGroupPlans.forEach(group => {
                // Find plans for this group at this exact timestamp
                const plansAtTime = group.plans.filter(p => p.timestamp === timestamp);
                const compStates = groupStates.get(group.name)!;

                plansAtTime.forEach(plan => {
                    if (plan.component_id) {
                        const key = plan.environment ? `${plan.component_id}-${plan.environment}` : plan.component_id;
                        compStates.set(key, { total: getPlanTotal(plan) });
                    }
                });

                // Calculate total drift for this group
                let groupDrift = 0;
                compStates.forEach(stats => {
                    groupDrift += stats.total;
                });

                dataPoint[group.name] = groupDrift;
            });

            return dataPoint;
        });

        return timeSeriesData;
    }, [groups]);

    if (data.length === 0) {
        return (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                No drift data available.
            </div>
        )
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === "dark" ? "#374151" : "#E5E7EB"} />
                <XAxis
                    dataKey="date"
                    stroke={theme === "dark" ? "#9CA3AF" : "#6B7280"}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    stroke={theme === "dark" ? "#9CA3AF" : "#6B7280"}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF",
                        borderColor: theme === "dark" ? "#374151" : "#E5E7EB",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        color: theme === "dark" ? "#F9FAFB" : "#111827"
                    }}
                />
                <Legend wrapperStyle={{ paddingTop: "10px" }} />
                {groups.map((group, idx) => (
                    <Line
                        key={group.name}
                        type="monotone"
                        dataKey={group.name}
                        name={group.name}
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4, fill: COLORS[idx % COLORS.length], strokeWidth: 2, stroke: theme === "dark" ? "#000" : "#fff" }}
                        activeDot={{ r: 6 }}
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    )
}
