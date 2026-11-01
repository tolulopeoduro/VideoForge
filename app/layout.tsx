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
      <body className="bg-studio-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
