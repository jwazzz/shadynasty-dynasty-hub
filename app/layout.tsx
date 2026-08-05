import type { Metadata } from "next";
import "./globals.css";

const title = "Shadynasty Dynasty League";
const description =
  "A live Google Sheets powered dynasty fantasy football hub for rosters, rookie tags, cuts, draft picks, league history, and trades.";
const siteUrl = "https://shadynastyfootball.com";
const imageUrl = `${siteUrl}/og.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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
      "Live rosters, rookie tags, cuts, draft picks, league history, and trades for the Shadynasty dynasty league.",
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
      "Live rosters, rookie tags, cuts, draft picks, league history, and trades for the Shadynasty dynasty league.",
    images: [imageUrl],
  },
};

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
