import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Score — X-Algorithm Tweet Scorer",
  description:
    "An open-source tweet scorer modelled on signals from xai-org/x-algorithm. Uncalibrated approximations, source-cited.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="v-lightsout isolate flex min-h-dvh flex-col bg-canvas text-ink">
        {children}
      </body>
    </html>
  );
}
