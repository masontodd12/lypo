import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { appOrigin } from "@/lib/site-url";
import { THEME_INIT_SCRIPT } from "@/components/ThemeToggle";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const TITLE = "Lypo — let your passion out";
const DESCRIPTION =
  "Free AI-powered app and website building for people building for others. No code. No cost. No gatekeeping.";

export const metadata: Metadata = {
  metadataBase: new URL(appOrigin()),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Lypo",
  icons: { icon: "/mark.png", apple: "/icon-192.png" },
  openGraph: {
    type: "website",
    siteName: "Lypo",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/icon-512.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/icon-512.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the theme before first paint so dark mode never flashes white. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${sora.variable} ${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
