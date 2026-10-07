import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { PrototypeProvider } from "@/features/prototype/prototype-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

export const metadata: Metadata = {
  title: "AssetHub",
  description: "Find and request event assets with confidence.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f5f7f9",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <TooltipProvider>
          <PrototypeProvider>{children}</PrototypeProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
