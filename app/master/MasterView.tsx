"use client";

import { useState, useTransition, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/Button";
import { logout } from "@/app/dashboard/actions";
import { createActivity, deleteActivity, type ActivityItem } from "./actions";
import { slugify } from "@/lib/slug";
import { spring } from "@/lib/motion";

export function MasterView({
  initialActivities,
}: {
  initialActivities: ActivityItem[];
}) {
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [isOpen, setIsOpen] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [pending, startTransition] = useTransition();
  const [logoutPending, startLogout] = useTransition();

  // Auto-generate slug from name
  useEffect(() => {
    setSlug(slugify(name));
  }, [name]);

  // Keep state sync with server updates
  useEffect(() => {
    setActivities(initialActivities);
  }, [initialActivities]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await createActivity({ name, slug, email, password });
      if (!res.ok) {
        setError(res.error ?? "Errore durante la creazione.");
        return;
      }
      // Reset form & close
      setName("");
      setSlug("");
      setEmail("");
      setPassword("");
      setIsOpen(false);
    });
  }

  function handleDelete(id: string, ownerId: string | null) {
    if (!confirm("Sei sicuro di voler eliminare questa attività? Questa azione è irreversibile e cancellerà tutti i suoi dati (operatori, servizi, appuntamenti).")) {
      return;
    }

    setIsDeletingId(id);
    startTransition(async () => {
      const res = await deleteActivity(id, ownerId);
      setIsDeletingId(null);
      if (!res.ok) {
        alert(res.error ?? "Errore durante l'eliminazione.");
      }
    });
  }

  // Calculate metrics
  const total = activities.length;
  const onboarded = activities.filter((a) => a.onboarded).length;
  const pendingOnboarding = total - onboarded;

  return (
    <main className="pb-24">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--line)] pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[0.8rem] font-[600] text-[var(--accent)]">
            <span>👑</span> Master Admin
          </div>
          <h1 className="text-title mt-1.5">Pannello SaaS</h1>
        </div>
        <Button
          variant="secondary"
          size="md"
          loading={logoutPending}
          onClick={() => startLogout(async () => { await logout(); })}
        >
          Esci
        </Button>
      </header>

      {/* Metrics Grid */}
      <section className="mt-6 grid grid-cols-3 gap-3">
        {[
          { label: "Attività", value: total, emoji: "🏠" },
          { label: "Attive", value: onboarded, emoji: "🟢" },
          { label: "In attesa", value: pendingOnboarding, emoji: "🟠" },
        ].map((m) => (
          <div key={m.label} className="card p-3 text-center">
            <span className="text-[1.2rem]">{m.emoji}</span>
            <div className="text-display mt-1 text-[1.6rem] font-[700]">{m.value}</div>
            <div className="text-caption mt-0.5">{m.label}</div>
          </div>
        ))}
      </section>

      {/* Main List */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-headline">Tutte le Attività</h2>
          <Button size="md" onClick={() => setIsOpen(true)}>
            + Nuova Attività
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {activities.length === 0 ? (
            <div className="card p-8 text-center text-[var(--ink-2)]">
              Nessuna attività creata. Inizia creandone una nuova.
            </div>
          ) : (
            activities.map((act) => (
              <div
                key={act.id}
                className="card flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-[620]">{act.name}</h3>
                    {act.onboarded ? (
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--success)_10%,transparent)] px-2 py-0.5 text-[0.72rem] font-[600] text-[var(--success)]">
                        Onboarded
                      </span>
                    ) : (
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-2 py-0.5 text-[0.72rem] font-[600] text-[var(--warning)]">
                        Onboarding
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[0.88rem] text-[var(--ink-2)]">
                    Slug: <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 text-[0.82rem] font-mono">{act.slug}</code>
                  </div>
                  <div className="mt-0.5 text-[0.88rem] text-[var(--ink-2)]">
                    Email: <span className="font-[520]">{act.owner_email || "Nessun proprietario"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <a
                    href={`/b/${act.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center justify-center rounded-[var(--r-xs)] border border-[var(--line)] px-3.5 text-[0.88rem] font-[560] transition-colors hover:bg-[var(--surface-2)] active:scale-[0.98]"
                  >
                    Vedi Pagina
                  </a>
                  <Button
                    variant="secondary"
                    size="md"
                    className="text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]"
                    loading={isDeletingId === act.id}
                    onClick={() => handleDelete(act.id, act.owner_id)}
                  >
                    Elimina
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Slide-over Modal / Sheet */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Scrim */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-[var(--scrim)] backdrop-blur-[2px]"
            />

            {/* Sliding Panel */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={spring.sheet}
              className="material fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[var(--r-xl)] border-t border-[var(--line-strong)] pb-safe shadow-[var(--shadow-sheet)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
                <h2 className="text-headline">Nuova Attività</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-[var(--surface-3)] text-[0.9rem] font-[550] transition-colors active:scale-95"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate} className="overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="text-[0.85rem] font-[560] text-[var(--ink-2)] block mb-1.5">
                    Nome Attività
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Es. Salone Giulia"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="text-[0.85rem] font-[560] text-[var(--ink-2)] block mb-1.5">
                    Slug URL
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="giulia"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="input font-mono"
                  />
                </div>

                <div>
                  <label className="text-[0.85rem] font-[560] text-[var(--ink-2)] block mb-1.5">
                    Email Proprietario
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="giulia@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="text-[0.85rem] font-[560] text-[var(--ink-2)] block mb-1.5">
                    Password Iniziale
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Minimo 6 caratteri"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                  />
                </div>

                {error && (
                  <p className="rounded-[var(--r-sm)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-3 py-2.5 text-[0.9rem] text-[var(--danger)]">
                    {error}
                  </p>
                )}

                <div className="pt-2">
                  <Button type="submit" size="lg" fullWidth loading={pending}>
                    Crea Attività
                  </Button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
