import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://episodic.mrbarry.dev";

export const metadata: Metadata = {
  title: "Episodic — TV Episode Ratings",
  description: "Explore IMDb ratings for every episode of your favourite TV shows, visualised by season.",
  alternates: { canonical: siteUrl },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-zinc-950 text-white antialiased`}
      >
        {/* Site header */}
        <header className="border-b border-zinc-800 bg-zinc-900" />

        {children}
        <Analytics />
      </body>
    </html>
  );
}
