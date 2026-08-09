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

// The browser tab, the Google result, and every shared link.
//
// The title says what Lypo is, because a stranger seeing it in search
// results has no idea otherwise. The line the site actually leads with
// carries the description instead, where there is room for it.
//
// Not led with "free": it invites the wrong comparison, and the reason to
// use this is that you can describe a site and have it, not the price.
// Kept under about 155 characters, which is where Google starts cutting.
const TITLE = "Lypo · website builder";
const DESCRIPTION =
  "Just build it. Describe what you want in plain words and get a real website you can publish today. No code, no tutorials, no gatekeeping.";

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
