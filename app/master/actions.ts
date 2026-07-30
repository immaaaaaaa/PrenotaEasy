"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";
import type { Business } from "@/lib/types";

export interface ActivityItem extends Business {
  owner_email: string | null;
}

/** Fetches all businesses and maps them to their owner email */
export async function getActivities(): Promise<ActivityItem[]> {
  try {
    const adminSupa = createAdminClient();

    const { data: businesses, error: bizError } = await adminSupa
      .from("businesses")
      .select("*")
      .order("created_at", { ascending: false });

    if (bizError) {
      throw bizError;
    }

    const { data: { users }, error: usersError } = await adminSupa.auth.admin.listUsers();
    if (usersError) {
      console.error("Error listing auth users:", usersError);
      return (businesses || []).map((b) => ({ ...b, owner_email: null }));
    }

    const userMap = new Map(users.map((u) => [u.id, u.email || null]));

    return (businesses || []).map((b) => ({
      ...b,
      owner_email: b.owner_id ? userMap.get(b.owner_id) || null : null,
    }));
  } catch (error) {
    console.error("getActivities error:", error);
    return [];
  }
}

/** Creates a new auth user and links it to a new business record with onboarded = false */
export async function createActivity(payload: {
  name: string;
  slug: string;
  email: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  const adminSupa = createAdminClient();

  const name = payload.name.trim();
  const rawSlug = payload.slug.trim() || slugify(name);
  const email = payload.email.trim();
  const password = payload.password;

  if (!name) return { ok: false, error: "Inserisci il nome dell'attività." };
  if (!rawSlug) return { ok: false, error: "Inserisci uno slug valido." };
  if (!email) return { ok: false, error: "Inserisci l'email dell'attività." };
  if (password.length < 6) return { ok: false, error: "La password deve avere almeno 6 caratteri." };

  // Check if slug is already in use
  const { data: existingSlug } = await adminSupa
    .from("businesses")
    .select("id")
    .eq("slug", rawSlug)
    .maybeSingle();

  if (existingSlug) {
    return { ok: false, error: `Lo slug "${rawSlug}" è già in uso. Scegline un altro.` };
  }

  // Create auth user
  const { data: userData, error: userError } = await adminSupa.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email so they can log in immediately
  });

  if (userError || !userData?.user) {
    return { ok: false, error: userError?.message || "Impossibile creare l'utente dell'attività." };
  }

  const userId = userData.user.id;

  // Insert business
  const { error: bizError } = await adminSupa.from("businesses").insert({
    owner_id: userId,
    name,
    slug: rawSlug,
    onboarded: false, // Must complete onboarding
  });

  if (bizError) {
    console.error("Error creating business, rolling back user creation:", bizError);
    // Rollback user creation
    await adminSupa.auth.admin.deleteUser(userId);
    return { ok: false, error: "Impossibile creare l'attività. Riprova." };
  }

  revalidatePath("/master");
  return { ok: true };
}

/** Deletes the business and the associated auth user */
export async function deleteActivity(
  businessId: string,
  ownerId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminSupa = createAdminClient();

    // 1. Delete business (which cascades to business_hours, services, employees, appointments, etc.)
    const { error: bizError } = await adminSupa
      .from("businesses")
      .delete()
      .eq("id", businessId);

    if (bizError) {
      throw bizError;
    }

    // 2. Delete auth user if it exists
    if (ownerId) {
      const { error: userError } = await adminSupa.auth.admin.deleteUser(ownerId);
      if (userError) {
        console.error("Error deleting auth user during deletion:", userError);
      }
    }

    revalidatePath("/master");
    return { ok: true };
  } catch (error: any) {
    console.error("deleteActivity error:", error);
    return { ok: false, error: error.message || "Errore durante l'eliminazione." };
  }
}

/** Toggles the operator pages premium feature for a business */
export async function toggleOperatorPages(
  businessId: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminSupa = createAdminClient();
    const { error } = await adminSupa
      .from("businesses")
      .update({ operator_pages_enabled: enabled })
      .eq("id", businessId);

    if (error) throw error;
    revalidatePath("/master");
    return { ok: true };
  } catch (error: any) {
    console.error("toggleOperatorPages error:", error);
    return { ok: false, error: error.message || "Impossibile aggiornare l'opzione." };
  }
}

/** Fetches operators (employees) for a given business including access tokens */
export async function getBusinessOperators(businessId: string): Promise<any[]> {
  try {
    const adminSupa = createAdminClient();
    const { data, error } = await adminSupa
      .from("employees")
      .select("id, name, color, active, access_token")
      .eq("business_id", businessId)
      .order("sort", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("getBusinessOperators error:", error);
    return [];
  }
}

/** Regenerates the access token UUID for an employee */
export async function regenerateOperatorToken(
  employeeId: string,
): Promise<{ ok: boolean; newToken?: string; error?: string }> {
  try {
    const adminSupa = createAdminClient();
    const newToken = crypto.randomUUID();

    const { error } = await adminSupa
      .from("employees")
      .update({ access_token: newToken })
      .eq("id", employeeId);

    if (error) throw error;
    return { ok: true, newToken };
  } catch (error: any) {
    console.error("regenerateOperatorToken error:", error);
    return { ok: false, error: error.message || "Errore durante la rigenerazione del link." };
  }
}
