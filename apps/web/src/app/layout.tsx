import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProviders } from "../providers/app-providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const title = "WAPP — Official WhatsApp Business Platform";
const description =
  "Enterprise WhatsApp customer engagement platform for sales, support and team collaboration.";

export const metadata: Metadata = {
  // Required for Next to resolve relative OG/Twitter image URLs into
  // absolute ones; reuses the same established env var robots.ts/
  // sitemap.ts already depend on (apps/web/.env.example), never a
  // fabricated production domain.
  metadataBase: process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL) : null,
  title,
  description,
  // FRD-001 Volume-9 §4.9/§11 — SEO infrastructure only (Architecture
  // Review, 2026-08-12): these are real, functioning OG/Twitter defaults
  // every page inherits unless it calls `generateMetadata` to override
  // them, not aspirational marketing copy for pages that don't exist yet.
  // The image is the same placeholder mark `manifest.ts`'s icons use — no
  // real brand asset exists in this repo yet (see docs/TECH-DEBT.md).
  openGraph: {
    title,
    description,
    siteName: "WAPP",
    type: "website",
    locale: "en_US",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title,
    description,
    images: ["/icons/icon-512.png"],
  },
  // FRD-001 Volume-9 §4.3 — apps/web-only PWA install experience; the
  // `manifest` link itself is auto-injected by app/manifest.ts's file
  // convention, this only adds iOS's separate "Add to Home Screen" support
  // (iOS Safari doesn't read the Web App Manifest's `display`/`name`).
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WAPP",
  },
};

// themeColor/colorScheme live on `viewport`, not `metadata`, per Next's
// metadata API split (anything requiring browser UI adaptation, not SEO).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
