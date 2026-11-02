import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZeroTrack Studio - Script-Driven AI Video Studio",
  description:
    "Semantic Anchoring AI Video Studio with Remotion, Kokoro-82M TTS, and Faster-Whisper",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bangers&family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@600;700;800&family=Montserrat:ital,wght@0,700;0,800;0,900;1,800;1,900&family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,700&family=Space+Grotesk:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-studio-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
