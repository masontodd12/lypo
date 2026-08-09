import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { appOrigin } from "@/lib/site-url";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

// The browser tab, the Google result, and every shared link. Kept to the
// three words on purpose: the domain already shows above it in search and
// beside it in a tab, so repeating the brand in the title only crowds it.
const TITLE = "just build it";
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
      <body className={`${sora.variable} ${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
