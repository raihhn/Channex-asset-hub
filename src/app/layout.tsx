import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "AssetHub",
  description: "AssetHub V2 operational foundation",
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
      <body>{children}</body>
    </html>
  );
}
