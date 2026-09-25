import Link from "next/link";
import { switchProfileAction } from "@/app/settings-actions";
import { currentProfile } from "@/lib/current";
import { dbPath, getDb } from "@/lib/db";
import { AVATARS } from "@/lib/profiles";
import { listProfiles } from "@/lib/repo/profile";
import { CreateProfileForm, DeleteProfileForm, PreferencesForm, ResetForm, RestoreForm } from "./SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile, settings } = await currentProfile();
  const profiles = listProfiles(getDb());

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Section title="You">
        <PreferencesForm name={profile.name} avatar={profile.avatar} theme={settings.theme} dailyGoal={settings.daily_goal} avatars={AVATARS} />
        <p className="mt-3 text-sm text-muted">
          Test date and goal score:{" "}
          <Link href="/onboarding" className="text-accent underline">
            edit your goals
          </Link>
          . Study days: <Link href="/plan" className="text-accent underline">study planner</Link>.
        </p>
      </Section>

      <Section title="Profiles" description="Each person on this computer can have their own profile, with separate progress.">
        <ul className="mb-4 divide-y divide-line rounded-xl border border-line">
          {profiles.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span>
                <span aria-hidden="true">{p.avatar}</span> {p.name}
                {p.id === profile.id && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">Active</span>}
              </span>
              <span className="flex items-center gap-2">
                {p.id !== profile.id && (
                  <form action={switchProfileAction.bind(null, p.id)}>
                    <button className="rounded-lg border border-line px-3 py-1 text-sm hover:bg-surface-2">Switch to</button>
                  </form>
                )}
                {profiles.length > 1 && <DeleteProfileForm id={p.id} name={p.name} />}
              </span>
            </li>
          ))}
        </ul>
        <CreateProfileForm avatars={AVATARS} />
      </Section>

      <Section title="Backup and restore" description={`All your data is in one file on this computer: ${dbPath()}`}>
        <div className="flex flex-col gap-4">
          <div>
            <a href="/api/backup" className="inline-block rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2">
              Download a backup
            </a>
            <p className="mt-1 text-xs text-muted">Includes every profile, all progress and any questions you imported.</p>
          </div>
          <RestoreForm />
        </div>
      </Section>

      <Section title="Reset progress" description={`Erase all answers, plans, tests, saved questions and vocab progress for ${profile.name}. Goals and the profile itself are kept.`}>
        <ResetForm name={profile.name} />
      </Section>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mb-3 text-sm break-words text-muted">{description}</p>}
      <div className={description ? "" : "mt-3"}>{children}</div>
    </section>
  );
}
