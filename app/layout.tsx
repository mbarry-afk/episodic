import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AdUnit } from "@/components/AdUnit";

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

export const metadata: Metadata = {
  title: "Episodic",
  description: "TV show episode ratings at a glance",
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
        {/* Site header — leaderboard only shown on md+ to avoid horizontal overflow */}
        <header className="border-b border-zinc-800 bg-zinc-900">
          <div className="hidden md:flex items-center justify-center px-4 py-3">
            <AdUnit size="leaderboard" />
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
