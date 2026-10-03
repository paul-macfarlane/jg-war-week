import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Lora } from "next/font/google";

import { PwaSetup } from "@/components/pwa-setup";
import { SessionBanner } from "@/components/session-banner";
import { DISPLAY_SCRIPT } from "@/lib/display";
import { APP_DESCRIPTION, APP_NAME, APP_THEME_COLOR } from "@/lib/pwa";

import "./globals.css";

const fontPresetSans = Inter({
  variable: "--font-preset-sans",
  subsets: ["latin"],
});

const fontPresetSerif = Lora({
  variable: "--font-preset-serif",
  subsets: ["latin"],
});

const fontPresetMono = JetBrains_Mono({
  variable: "--font-preset-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  // iOS Add to Home Screen: launch full-screen with this name and icon.
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
  icons: { apple: "/icons/apple-touch-icon.png" },
  // Next emits only `mobile-web-app-capable`; older iOS reads this one.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = { themeColor: APP_THEME_COLOR };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fontPresetSans.variable} ${fontPresetSerif.variable} ${fontPresetMono.variable} h-full antialiased`}
      // The inline script sets data-display before React hydrates.
      suppressHydrationWarning
    >
      <head>
        {/* Before any content, so a stored Light or Dark never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: DISPLAY_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <SessionBanner />
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
