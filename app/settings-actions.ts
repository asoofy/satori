"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { restoreBackup } from "@/lib/backup";
import { currentProfile, PROFILE_COOKIE } from "@/lib/current";
import { getDb } from "@/lib/db";
import { AVATARS, createProfile, deleteProfile, resetProgress } from "@/lib/profiles";
import { getProfile, renameProfile, updateSettings } from "@/lib/repo/profile";

export type SettingsState = { ok: boolean; error?: string; message?: string };

const SettingsSchema = z.object({
  name: z.string().trim().min(1).max(40),
  avatar: z.string().refine((a) => AVATARS.includes(a), "Pick an avatar."),
  theme: z.enum(["system", "light", "dark"]),
  daily_goal: z.coerce.number().int().min(1).max(100),
});

export async function saveSettingsAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const p = SettingsSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { profile } = await currentProfile();
  const db = getDb();
  renameProfile(db, profile.id, p.data.name, p.data.avatar);
  updateSettings(db, profile.id, { theme: p.data.theme, daily_goal: p.data.daily_goal });
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

async function setProfileCookie(id: number) {
  (await cookies()).set(PROFILE_COOKIE, String(id), { path: "/", maxAge: 60 * 60 * 24 * 365 * 5, sameSite: "lax", httpOnly: true });
}

export async function switchProfileAction(id: number): Promise<void> {
  if (!getProfile(getDb(), id)) return;
  await setProfileCookie(id);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function createProfileAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const name = String(form.get("name") ?? "").trim();
  const avatar = String(form.get("avatar") ?? AVATARS[0]);
  if (!name) return { ok: false, error: "Enter a name." };
  const id = createProfile(getDb(), name, avatar);
  await setProfileCookie(id);
  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function deleteProfileAction(id: number, _prev: SettingsState, form: FormData): Promise<SettingsState> {
  const db = getDb();
  const target = getProfile(db, id);
  if (!target) return { ok: false, error: "Profile not found." };
  if (String(form.get("confirm") ?? "").trim() !== target.name) return { ok: false, error: `Type “${target.name}” to confirm.` };
  try {
    deleteProfile(db, id);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const { profile } = await currentProfile();
  if (profile.id === id) (await cookies()).delete(PROFILE_COOKIE);
  revalidatePath("/", "layout");
  return { ok: true, message: `Deleted ${target.name}.` };
}

export async function resetProgressAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const { profile } = await currentProfile();
  if (String(form.get("confirm") ?? "").trim() !== profile.name) return { ok: false, error: `Type “${profile.name}” to confirm.` };
  resetProgress(getDb(), profile.id);
  revalidatePath("/", "layout");
  return { ok: true, message: "Progress reset. Your goals and profile were kept." };
}

export async function restoreAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a backup file." };
  if (!form.get("confirm")) return { ok: false, error: "Tick the box to confirm you want to replace your current data." };
  try {
    const r = restoreBackup(Buffer.from(await file.arrayBuffer()));
    (await cookies()).delete(PROFILE_COOKIE);
    revalidatePath("/", "layout");
    return { ok: true, message: `Restored. Your previous data was saved as data/${r.savedPrevious}.` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
