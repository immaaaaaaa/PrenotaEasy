/**
 * Phone + WhatsApp helpers. Defaults to Italy (+39): Italian mobiles (3xx) and
 * landlines (0xx) both keep their national number after the country code.
 */
export function normalizePhone(raw: string, countryCode = "39"): string {
  const p = raw.trim().replace(/[^\d+]/g, "");
  if (p.startsWith("+")) return p;
  if (p.startsWith("00")) return "+" + p.slice(2);
  if (p === "") return "";
  return "+" + countryCode + p;
}

/** Digits-only form wa.me expects (no '+', no spaces). */
export function waNumber(phoneE164: string): string {
  return phoneE164.replace(/[^\d]/g, "");
}

export function waLink(phoneE164: string, message: string): string {
  return `https://wa.me/${waNumber(phoneE164)}?text=${encodeURIComponent(message)}`;
}

/** "Microblading + Ridisegno forma" when add-ons were chosen, plain name otherwise. */
export function serviceLabelWithAddons(
  serviceName: string,
  addons?: { name: string }[] | null,
): string {
  if (!addons || addons.length === 0) return serviceName;
  return `${serviceName} + ${addons.map((a) => a.name).join(" + ")}`;
}

export function rescheduleMessage(o: {
  customerName: string;
  businessName: string;
  serviceName: string;
  when: string; // e.g. "lunedì 14 luglio alle 15:30"
}): string {
  const first = o.customerName.split(" ")[0] || o.customerName;
  return (
    `Ciao ${first}! 👋\n` +
    `Il tuo appuntamento da ${o.businessName} (${o.serviceName}) è stato spostato a ${o.when}.\n` +
    `Se non va bene, rispondi pure a questo messaggio. A presto! 💇`
  );
}

export function cancelMessage(o: {
  customerName: string;
  businessName: string;
  serviceName: string;
  when: string;
}): string {
  const first = o.customerName.split(" ")[0] || o.customerName;
  return (
    `Ciao ${first},\n` +
    `purtroppo dobbiamo annullare il tuo appuntamento da ${o.businessName} ` +
    `(${o.serviceName}) del ${o.when}.\n` +
    `Scrivici per riprogrammarlo quando vuoi. Ci dispiace per il disagio!`
  );
}

export function confirmMessage(o: {
  customerName: string;
  businessName: string;
  serviceName: string;
  when: string;
}): string {
  const first = o.customerName.split(" ")[0] || o.customerName;
  return (
    `Ciao ${first}! ✅\n` +
    `Il tuo appuntamento da ${o.businessName} (${o.serviceName}) è confermato per ${o.when}.\n` +
    `A presto! 💇`
  );
}
