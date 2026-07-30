"use server";

import { revalidatePath } from "next/cache";
import { getSessionBusiness } from "@/lib/auth";
import { slugify } from "@/lib/slug";

export interface OnboardingPayload {
  name: string;
  phone: string;
  address: string;
  hours: {
    weekday: number;
    isClosed: boolean;
    open: string;
    close: string;
    breakStart: string | null;
    breakEnd: string | null;
  }[];
  services: { name: string; durationMin: number; priceCents: number; description?: string }[];
  employees: { name: string; color: string }[];
}

export async function createBusiness(
  payload: OnboardingPayload,
): Promise<{ ok: boolean; slug?: string; error?: string }> {
  const { supa, user, business } = await getSessionBusiness();
  if (!user) return { ok: false, error: "Sessione scaduta. Accedi di nuovo." };
  if (business && business.onboarded) return { ok: true, slug: business.slug };

  const name = payload.name.trim();
  if (!name) return { ok: false, error: "Inserisci il nome dell'attività." };

  let bizId: string;
  let slug: string;

  if (business) {
    // We already have a business pre-created by the master. Update it!
    const { data: updatedBiz, error: updateError } = await supa
      .from("businesses")
      .update({
        name,
        phone: payload.phone.trim() || null,
        address: payload.address.trim() || null,
        onboarded: true,
      })
      .eq("id", business.id)
      .select("id, slug")
      .single();

    if (updateError || !updatedBiz) {
      console.error("updateError:", updateError);
      return { ok: false, error: "Impossibile salvare l'attività. Riprova." };
    }
    bizId = updatedBiz.id;
    slug = updatedBiz.slug;
  } else {
    // Find a free slug.
    const base = slugify(name);
    slug = base;
    let n = 1;
    for (let i = 0; i < 60; i++) {
      const { data } = await supa
        .from("businesses")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!data) break;
      n += 1;
      slug = `${base}-${n}`;
    }

    const { data: newBiz, error: insertError } = await supa
      .from("businesses")
      .insert({
        owner_id: user.id,
        name,
        slug,
        phone: payload.phone.trim() || null,
        address: payload.address.trim() || null,
        onboarded: true,
      })
      .select("id, slug")
      .single();

    if (insertError || !newBiz) {
      console.error("insertError:", insertError);
      return { ok: false, error: "Impossibile creare l'attività. Riprova." };
    }
    bizId = newBiz.id;
    slug = newBiz.slug;
  }

  const hoursRows = payload.hours.map((h) => ({
    business_id: bizId,
    weekday: h.weekday,
    is_closed: h.isClosed,
    open_time: h.isClosed ? null : h.open,
    close_time: h.isClosed ? null : h.close,
    break_start: h.isClosed ? null : h.breakStart || null,
    break_end: h.isClosed ? null : h.breakEnd || null,
  }));
  await supa.from("business_hours").insert(hoursRows);

  const svc = payload.services
    .filter((s) => s.name.trim() && s.durationMin > 0)
    .map((s, i) => ({
      business_id: bizId,
      name: s.name.trim(),
      duration_min: s.durationMin,
      price_cents: s.priceCents,
      description: s.description?.trim() || null,
      sort: i,
    }));
  if (svc.length) await supa.from("services").insert(svc);

  const emp = payload.employees
    .filter((e) => e.name.trim())
    .map((e, i) => ({
      business_id: bizId,
      name: e.name.trim(),
      color: e.color,
      sort: i,
    }));
  if (emp.length) await supa.from("employees").insert(emp);

  revalidatePath("/dashboard");
  return { ok: true, slug };
}
