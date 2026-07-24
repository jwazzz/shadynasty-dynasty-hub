import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "Shadynasty Dynasty League";
const description =
  "A live Google Sheets powered dynasty fantasy football hub for draft picks, league history, all trades, and team rosters.";

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol =
    headerStore.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const metadataBase = new URL(host ? `${protocol}://${host}` : "http://localhost:3000");
  const imageUrl = new URL("/og.png", metadataBase).toString();

  return {
    metadataBase,
    title,
    description,
    icons: {
      icon: [
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon.png", sizes: "512x512", type: "image/png" },
      ],
      shortcut: "/favicon.png",
      apple: "/apple-touch-icon.png",
    },
    openGraph: {
      title,
      description:
        "Live draft picks, league history, all trades, and team rosters for the Shadynasty dynasty league.",
      images: [
        {
          url: imageUrl,
          width: 1600,
          height: 900,
          alt: "Shadynasty 2026 draft board",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description:
        "Live draft picks, league history, all trades, and team rosters for the Shadynasty dynasty league.",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
