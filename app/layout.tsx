import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chord Progression MVP",
  description: "YouTube URL and audio upload chord progression demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
