import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import "./globals.css";
import { PWARegistrar } from "@/components/PWARegistrar";
import { Providers } from "./providers";

export const metadata: Metadata = {
  applicationName: "Wandr",
  title: "Wandr",
  description: "Local travel picks and routes.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Wandr",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/wandr-favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/wandr-icon.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/wandr-icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/wandr-apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#9fe870",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <PWARegistrar />
      </body>
    </html>
  );
}
