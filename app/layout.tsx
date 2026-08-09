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
// The title says what Lypo is, because a stranger seeing it in a list of
// search results has no idea otherwise. The description is the line the
// site leads with and nothing else, deliberately: it is the whole pitch.
//
// No "free" anywhere. It invites a comparison on price, when the reason to
// use this is that you can describe a site and then have one.
const TITLE = "Lypo · website builder";
const DESCRIPTION = "Just build it.";

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
