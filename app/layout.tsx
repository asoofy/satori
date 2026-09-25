import type { Metadata, Viewport } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import { InlineScript } from "@/components/InlineScript";
import { currentProfile } from "@/lib/current";

export const metadata: Metadata = {
  title: { default: "Satori — SAT prep", template: "%s · Satori" },
  description: "Free, open-source, local study app for the digital SAT.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#131217" },
  ],
};

// Sets data-theme before first paint so there's no flash when the preference is "system".
const themeScript = `(function(){try{var d=document.documentElement;var p=d.dataset.themePref;if(p==='system'){d.dataset.theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}}catch(e){}})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { settings } = await currentProfile();
  const pref = settings.theme;
  return (
    <html lang="en" data-theme={pref === "dark" ? "dark" : "light"} data-theme-pref={pref} suppressHydrationWarning>
      <head>
        <InlineScript html={themeScript} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
