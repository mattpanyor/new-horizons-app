import type { Metadata, Viewport } from "next";
import { Geist, Cinzel } from "next/font/google";
import "./globals.css";
import HomeArtLayer from "@/components/HomeArtLayer";
import { getHomeScreenArt } from "@/lib/settings/service";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "New Horizons App",
  description: "Helper for World Building",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Async because the home screen art is read here rather than per page — that is
// what lets one canvas serve every route. Every route that shows the planet
// renders per request, so this always reflects the admin's current choice.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const homeArt = await getHomeScreenArt();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${cinzel.variable} antialiased`}
        suppressHydrationWarning
      >
        <HomeArtLayer preset={homeArt} />
        {children}
      </body>
    </html>
  );
}
