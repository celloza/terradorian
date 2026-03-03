'use client'

import { SessionProvider } from "next-auth/react"
import { SWRConfig } from "swr"
import { useEffect, useState } from "react"

export function Providers({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    return (
        <SWRConfig value={{ suspense: true }}>
            <SessionProvider>
                {mounted ? children : null}
            </SessionProvider>
        </SWRConfig>
    )
}
