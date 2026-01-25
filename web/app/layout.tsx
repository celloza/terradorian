import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import packageJson from "../package.json"; // Import version from package.json
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Terradorian",
  description: "Drift Detection Platform",
};

import { Providers } from "./providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  console.log(`Terradorian Web App Version: ${packageJson.version}`);

  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
