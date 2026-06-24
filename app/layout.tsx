import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MenuBar } from "./components/MenuBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Data Analyst — Ask Your Data Anything",
  description:
    "Upload Excel files or screenshots and ask questions in plain English. Universal AI analysis tools compute real answers, insights, and recommendations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-dvh flex-col">
        <MenuBar />
        <div className="min-h-0 flex-1">{children}</div>
      </body>
    </html>
  );
}
