import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Liftlog",
  description: "Routines, sets and progress for your lifts.",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  // Lets iPhones run it as a Home Screen app, which is what iOS needs for lock-screen alerts
  appleWebApp: { capable: true, title: "Liftlog", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f1ea",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* use-credentials so the manifest still loads when Cloudflare Access sits in front */}
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
      </head>
      <body>{children}</body>
    </html>
  );
}
