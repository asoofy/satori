import { Logo } from "@/components/Logo";
import { currentProfile } from "@/lib/current";
import { OnboardingForm } from "./OnboardingForm";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const { profile, settings } = await currentProfile();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-10">
      <div className="mb-6 flex items-center gap-3 text-accent">
        <Logo size={44} />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">{settings.onboarded ? "Your goals" : "Welcome to Satori"}</h1>
          <p className="text-muted">Free SAT practice that runs on your own computer.</p>
        </div>
      </div>
      <OnboardingForm
        initial={{
          name: profile.name === "Student" && !settings.onboarded ? "" : profile.name,
          test_date: settings.test_date ?? "",
          goal_score: settings.goal_score,
          current_score: settings.current_score,
          daily_goal: settings.daily_goal,
        }}
        editing={!!settings.onboarded}
      />
    </main>
  );
}
