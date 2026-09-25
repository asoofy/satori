import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { getProfile, getSettings, listProfiles, type Profile, type Settings } from "@/lib/repo/profile";

export const PROFILE_COOKIE = "satori_profile";

/** The active local profile (chosen via cookie), falling back to the first profile. */
export async function currentProfile(): Promise<{ profile: Profile; settings: Settings }> {
  const db = getDb();
  const jar = await cookies();
  const id = Number(jar.get(PROFILE_COOKIE)?.value);
  let profile = Number.isFinite(id) && id > 0 ? getProfile(db, id) : null;
  if (!profile) profile = listProfiles(db)[0];
  return { profile, settings: getSettings(db, profile.id) };
}
