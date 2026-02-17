import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRelativeTime(date: Date | string) {
  if (!date) return "Unknown";
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

// Helper to group environments
// Returns: { "Production": { "UK South": ["production-uks-1", ...], "Global": ["production-global"] } }
export const groupEnvironments = (envs: string[], config: Record<string, { group: string, region: string }> | undefined) => {
  const grouped: Record<string, Record<string, string[]>> = {}

  envs.forEach(env => {
    const conf = config?.[env] || { group: "Ungrouped", region: "Global" }
    const group = conf.group || "Ungrouped"
    const region = conf.region || "Global" // Default to 'Global' if region is empty

    if (!grouped[group]) grouped[group] = {}
    if (!grouped[group][region]) grouped[group][region] = []

    grouped[group][region].push(env)
  })

  return grouped
}
