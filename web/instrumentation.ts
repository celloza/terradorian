
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        try {
            const fs = await import('fs');
            const path = await import('path');

            // In standalone mode, we are running 'node server.js' in the root of the package.
            // version.json should be in the current working directory.
            const versionPath = path.join(process.cwd(), 'version.json');

            if (fs.existsSync(versionPath)) {
                const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
                console.log(`\n\n=================================================================`);
                console.log(`   TERRADORIAN WEB APP VERSION: ${versionData.version}`);
                console.log(`=================================================================\n\n`);
            } else {
                console.log(`\n[Instrumentation] version.json not found at ${versionPath}`);
                // Fallback or dev mode check
            }
        } catch (err) {
            console.error("[Instrumentation] Failed to load version info:", err);
        }
    }
}
