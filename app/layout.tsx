import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "Shadynasty Dynasty League";
const description =
  "A live Google Sheets powered dynasty fantasy football hub for draft picks, results, trades, and team rosters.";

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
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title,
      description:
        "Live draft picks, results, trades, and team rosters for the Shadynasty dynasty league.",
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
        "Live draft picks, results, trades, and team rosters for the Shadynasty dynasty league.",
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
