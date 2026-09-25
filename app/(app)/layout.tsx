import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { aiConfigured } from "@/lib/ai";
import { gettingStarted } from "@/lib/checklist";
import { currentProfile } from "@/lib/current";
import { getDb } from "@/lib/db";
import { NAV } from "@/lib/nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { profile, settings } = await currentProfile();
  if (!settings.onboarded) redirect("/onboarding");
  const list = gettingStarted(getDb(), profile.id);
  return (
    <Shell
      nav={NAV.filter((n) => !n.requiresAi || aiConfigured())}
      profileName={`${profile.avatar} ${profile.name}`}
      theme={settings.theme}
      checklist={{ done: list.filter((i) => i.done).length, total: list.length }}
    >
      {children}
    </Shell>
  );
}
