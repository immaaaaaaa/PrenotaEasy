import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Business } from "./types";

/** Current user + their business (either may be null). */
export async function getSessionBusiness() {
  const supa = await createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) return { supa, user: null, business: null as Business | null };

  const { data: business } = await supa
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  return { supa, user, business: (business as Business | null) ?? null };
}

export function isMaster(user: any): boolean {
  if (!user) return false;
  const masterEmail = process.env.NEXT_PUBLIC_MASTER_EMAIL || "admin@prenotaeasy.com";
  return user.email === masterEmail;
}

/** Guard for owner pages: redirects to login, then to onboarding if needed. */
export async function requireBusiness() {
  const { supa, user, business } = await getSessionBusiness();
  if (!user) redirect("/login");
  if (isMaster(user)) redirect("/master");
  if (!business || !business.onboarded) redirect("/onboarding");
  return { supa, user, business };
}
