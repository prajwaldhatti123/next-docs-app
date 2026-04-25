import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Internal Docs", template: "%s | Docs" },
  description: "Secure internal documentation system",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ fontFamily: "var(--font-inter, var(--ff-sans))" }}>
        {children}
      </body>
    </html>
  );
}
