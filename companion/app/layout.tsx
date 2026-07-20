import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rental Tracker Companion",
  description: "Capture rental receipts in the field and send them to Rental Tracker.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "Rental Tracker Companion",
    description: "Capture rental receipts in the field and finish them on your desktop.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rental Tracker Companion",
    description: "Capture rental receipts in the field and finish them on your desktop.",
    images: ["/og.png"],
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
