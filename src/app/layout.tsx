import type { Metadata } from "next";
import Script from "next/script";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "dmarcRadar",
  description: "Enterprise DMARC aggregate report analysis",
};

// Runs before hydration so the stored/system theme applies on first paint — without this,
// a user who picked dark while their OS is set to light sees a flash of the light theme.
const THEME_INIT_SCRIPT = `
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    var palette = localStorage.getItem('palette');
    if (palette) document.documentElement.dataset.palette = palette;
  } catch (e) {}
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body>
        <Providers session={session}>
          {session ? <Nav /> : null}
          <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
