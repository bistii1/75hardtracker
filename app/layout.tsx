import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "75 Hard Tracker",
  description: "A shared 75 Hard progress tracker for Priya and Karthik.",
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
