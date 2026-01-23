import { useState } from "react"
import { UploadPlanModal } from "./upload-plan-modal"
import { ManageComponentsModal } from "./manage-components-modal"
import { ManageTokensModal } from "./manage-tokens-modal"
import { ManageEnvironmentsModal } from "./manage-environments-modal"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Layers, UploadCloud, Key, Settings2, ChevronDown, Box } from "lucide-react"

export function DashboardActionMenu({ onUploadComplete }: { onUploadComplete: () => void }) {
    const [activeModal, setActiveModal] = useState<"upload" | "components" | "tokens" | "environments" | null>(null)

    return (
        <div className="flex items-center gap-2">
            <Button onClick={() => setActiveModal("upload")}>
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload Plan
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                        <Settings2 className="mr-2 h-4 w-4" />
                        Manage
                        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[220px]">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setActiveModal("components")}>
                        <Layers className="mr-2 h-4 w-4" /> Manage Components
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setActiveModal("environments")}>
                        <Box className="mr-2 h-4 w-4" /> Manage Environments
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setActiveModal("tokens")}>
                        <Key className="mr-2 h-4 w-4" /> Manage API Keys
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Modals */}
            <UploadPlanModal
                isOpen={activeModal === "upload"}
                onChange={(open: boolean) => !open && setActiveModal(null)}
                onUploadComplete={onUploadComplete}
            />
            <ManageComponentsModal
                isOpen={activeModal === "components"}
                onChange={(open: boolean) => !open && setActiveModal(null)}
            />
            <ManageEnvironmentsModal
                isOpen={activeModal === "environments"}
                onChange={(open: boolean) => !open && setActiveModal(null)}
            />
            <ManageTokensModal
                isOpen={activeModal === "tokens"}
                onChange={(open: boolean) => !open && setActiveModal(null)}
            />
        </div>
    )
}
