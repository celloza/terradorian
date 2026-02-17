import packageJson from "../../package.json"

export function ContextSidebar() {
    const pathname = usePathname()
    // ... existing code ...
    return (
        <div className="w-64 bg-[#0F1115] text-white border-r border-[#1F2125] flex flex-col h-full pt-4">
            <div className="px-3 py-2">
                {/* ... existing links ... */}
            </div>

            <div className="mt-auto px-3 py-4">
                <div className="px-4 pb-2 text-xs text-zinc-500">
                    v{packageJson.version}
                </div>
                <Button
                    variant="ghost"
                    asChild
                    className={cn(
                        "w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800",
                        isSettings && "bg-[#2D313A] text-white font-medium hover:bg-[#2D313A]"
                    )}
                >
                    <Link href={`/p/${projectId}/settings`}>
                        <Settings className="mr-3 h-4 w-4" />
                        Settings
                    </Link>
                </Button>
            </div>
        </div>
    )
}
