import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgenticEscrow - Autonomous AI Dispute Resolution on GenLayer",
  description: "Trustless decentralized escrow and AI-powered judicial arbitration protocol powered by GenLayer's non-deterministic consensus.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0f] text-slate-100 antialiased selection:bg-emerald-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
