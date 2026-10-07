import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SignFlow | Secure Online Contract Signing",
  description: "A focused, professional online contract signing platform with zero friction and enterprise-grade audit integrity.",
  icons: {
    icon: "/esayn_ico.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-white text-black">
      <body className={`${inter.variable} min-h-full flex flex-col font-sans antialiased bg-white text-black selection:bg-black selection:text-white`}>
        {children}
      </body>
    </html>
  );
}
