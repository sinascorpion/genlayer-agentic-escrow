import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgenticEscrow - Autonomous AI Dispute Resolution on GenLayer",
  description: "Trustless decentralized escrow and AI-powered judicial arbitration protocol powered by GenLayer's non-deterministic consensus.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              tailwind.config = {
                darkMode: 'class',
                theme: {
                  extend: {
                    colors: {
                      background: '#07090e',
                    }
                  }
                }
              }
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[#07090e] text-slate-100 antialiased selection:bg-emerald-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
