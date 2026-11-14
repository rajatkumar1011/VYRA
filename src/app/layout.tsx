import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VYRA — Your store. A voice away.",
  description:
    "Voice-first neighbourhood commerce. Shop in Hindi, English and Hinglish with Gnani-powered speech, a live basket and a clear confirmation.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(() => {
          let saved;
          try { saved = localStorage.getItem('vyra-theme'); } catch {}
          document.documentElement.dataset.theme = saved === 'light' || saved === 'dark'
            ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        })();` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
