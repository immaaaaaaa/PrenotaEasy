"use client";

import { useState, useTransition, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/Button";
import { logout } from "@/app/dashboard/actions";
import { 
  createActivity, 
  deleteActivity, 
  toggleOperatorPages, 
  getBusinessOperators, 
  regenerateOperatorToken, 
  type ActivityItem 
} from "./actions";
import { Sheet } from "@/components/ui/Sheet";
import { slugify } from "@/lib/slug";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/cn";

export function MasterView({
  initialActivities,
}: {
  initialActivities: ActivityItem[];
}) {
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [isOpen, setIsOpen] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Premium Operator Pages states
  const [activeBiz, setActiveBiz] = useState<ActivityItem | null>(null);
  const [operators, setOperators] = useState<any[]>([]);
  const [loadingOperators, setLoadingOperators] = useState(false);
  const [copiedOpId, setCopiedOpId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [togglingPremium, setTogglingPremium] = useState(false);

  // Fetch operators when activeBiz changes
  useEffect(() => {
    if (!activeBiz) {
      setOperators([]);
      return;
    }
    setLoadingOperators(true);
    getBusinessOperators(activeBiz.id)
      .then((data) => setOperators(data))
      .finally(() => setLoadingOperators(false));
  }, [activeBiz]);

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

  async function handleTogglePremium(enabled: boolean) {
    if (!activeBiz) return;
    setTogglingPremium(true);
    const res = await toggleOperatorPages(activeBiz.id, enabled);
    setTogglingPremium(false);
    if (res.ok) {
      setActivities(prev => prev.map(a => a.id === activeBiz.id ? { ...a, operator_pages_enabled: enabled } : a));
      setActiveBiz(prev => prev ? { ...prev, operator_pages_enabled: enabled } : null);
    } else {
      alert(res.error || "Errore");
    }
  }

  async function handleRegenerateToken(employeeId: string) {
    if (!confirm("Sei sicuro di voler rigenerare il link? Il link precedente smetterà immediatamente di funzionare.")) {
      return;
    }
    setRegeneratingId(employeeId);
    const res = await regenerateOperatorToken(employeeId);
    setRegeneratingId(null);
    if (res.ok && res.newToken) {
      setOperators(prev => prev.map(op => op.id === employeeId ? { ...op, access_token: res.newToken } : op));
    } else {
      alert(res.error || "Errore");
    }
  }

  // Calculate metrics
  const total = activities.length;
  const onboarded = activities.filter((a) => a.onboarded).length;
  const pendingOnboarding = total - onboarded;

  return (
    <main className="pb-24 max-w-4xl mx-auto px-6 pt-8">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--line)] pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg)] border border-[var(--line)] px-3 py-1 text-xs font-bold text-[var(--ink)]">
            <span>👑</span> Master Admin
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--ink)] tracking-tight mt-2.5">Pannello SaaS</h1>
        </div>
        <button
          disabled={logoutPending}
          onClick={() => startLogout(async () => { await logout(); })}
          className="ios-btn-secondary px-4 py-2 text-xs font-bold border border-[var(--line)] bg-[var(--surface)]"
        >
          {logoutPending ? "..." : "Esci"}
        </button>
      </header>

      {/* Metrics Grid */}
      <section className="mt-6 grid grid-cols-3 gap-3">
        {[
          { label: "Attività", value: total, emoji: "🏠" },
          { label: "Attive", value: onboarded, emoji: "🟢" },
          { label: "In attesa", value: pendingOnboarding, emoji: "🟠" },
        ].map((m) => (
          <div key={m.label} className="ios-card p-4 text-center bg-[var(--surface)] border border-[var(--line)] shadow-sm">
            <span className="text-[1.2rem]">{m.emoji}</span>
            <div className="text-2xl font-black text-[var(--ink)] tracking-tight mt-1">{m.value}</div>
            <div className="text-[10px] text-[var(--ink-2)] font-bold uppercase tracking-wider mt-0.5">{m.label}</div>
          </div>
        ))}
      </section>

      {/* Main List */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--ink)] tracking-tight">Tutte le Attività</h2>
          <button onClick={() => setIsOpen(true)} className="ios-btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider h-10">
            + Nuova Attività
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {activities.length === 0 ? (
            <div className="ios-card p-8 text-center text-[var(--ink-2)] font-medium bg-[var(--surface)] border border-[var(--line)]">
              Nessuna attività creata. Inizia creandone una nuova.
            </div>
          ) : (
            activities.map((act) => (
              <div
                key={act.id}
                className="ios-card flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--ink)] hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-[var(--ink)] text-sm">{act.name}</h3>
                    {act.onboarded ? (
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--success)_10%,transparent)] px-2 py-0.5 text-[0.72rem] font-bold text-[var(--success)]">
                        Onboarded
                      </span>
                    ) : (
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-2 py-0.5 text-[0.72rem] font-bold text-[var(--warning)]">
                        Onboarding
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-[var(--ink-2)]">
                    Slug: <code className="rounded bg-[var(--bg)] border border-[var(--line)] px-1 py-0.5 text-[0.75rem] font-mono text-[var(--ink)]">{act.slug}</code>
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--ink-2)]">
                    Email: <span className="font-semibold text-[var(--ink)]">{act.owner_email || "Nessun proprietario"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <a
                    href={`/b/${act.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--line)] px-4 text-xs font-bold text-[var(--ink)] transition-all hover:bg-[var(--bg)] active:scale-[0.98] bg-[var(--surface)]"
                  >
                    Vedi Pagina
                  </a>
                  <button
                    onClick={() => setActiveBiz(act)}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--line)] px-4 text-xs font-bold text-[var(--ink)] transition-all hover:bg-[var(--bg)] active:scale-[0.98] cursor-pointer bg-[var(--surface)]"
                  >
                    Operatori
                  </button>
                  <button
                    onClick={() => handleDelete(act.id, act.owner_id)}
                    disabled={isDeletingId === act.id}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-[#ba1a1a]/30 px-4 text-xs font-bold text-[#ba1a1a] transition-all hover:bg-[#ba1a1a]/5 active:scale-[0.98] cursor-pointer bg-transparent"
                  >
                    {isDeletingId === act.id ? "..." : "Elimina"}
                  </button>
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
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl border-t border-[var(--line)] pb-safe shadow-lg bg-[var(--surface)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
                <h2 className="text-base font-bold text-[var(--ink)] tracking-tight">Nuova Attività</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-[var(--bg)] text-[var(--ink-2)] border border-[var(--line)] text-xs font-bold transition-all active:scale-95 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate} className="overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider block mb-1.5">
                    Nome Attività
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Es. Salone Giulia"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-12 rounded-xl bg-[var(--bg)] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-sm font-medium text-[var(--ink)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider block mb-1.5">
                    Slug URL
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="giulia"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full h-12 rounded-xl bg-[var(--bg)] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-sm font-medium text-[var(--ink)] font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider block mb-1.5">
                    Email Proprietario
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="giulia@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 rounded-xl bg-[var(--bg)] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-sm font-medium text-[var(--ink)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider block mb-1.5">
                    Password Iniziale
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Minimo 6 caratteri"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 rounded-xl bg-[var(--bg)] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-sm font-medium text-[var(--ink)]"
                  />
                </div>

                {error && (
                  <p className="rounded-xl bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-3 py-2.5 text-xs font-semibold text-[var(--danger)]">
                    {error}
                  </p>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className="w-full h-12 rounded-full ios-btn-primary font-bold text-sm tracking-wider"
                  >
                    {pending ? "Creazione..." : "Crea Attività"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Premium Operator Pages Config Sheet */}
      <Sheet
        open={!!activeBiz}
        onClose={() => setActiveBiz(null)}
        title={activeBiz ? `Gestione Operatori: ${activeBiz.name}` : ""}
        dismissible={true}
      >
        <div className="space-y-6 py-2">
          {/* Toggle option */}
          <div className="ios-card p-4 flex items-center justify-between bg-[var(--surface-2)]/30 border border-[var(--line)]">
            <div>
              <h4 className="font-bold text-sm text-[var(--ink)]">Pagine Operatore (Premium)</h4>
              <p className="mt-0.5 text-xs text-[var(--ink-2)] font-medium">Abilita agende individuali protette con token.</p>
            </div>
            <button
              onClick={() => handleTogglePremium(!activeBiz?.operator_pages_enabled)}
              disabled={togglingPremium}
              className={cn(
                "h-7 w-12 rounded-full p-0.5 transition-all duration-300 relative focus:outline-none cursor-pointer border border-transparent",
                activeBiz?.operator_pages_enabled ? "bg-[#34c759]" : "bg-[#e5e5ea]"
              )}
            >
              <div 
                className={cn(
                  "h-6 w-6 rounded-full bg-[var(--surface)] shadow-sm transition-transform duration-300 transform",
                  activeBiz?.operator_pages_enabled ? "translate-x-5" : "translate-x-0"
                )} 
              />
            </button>
          </div>

          {activeBiz?.operator_pages_enabled ? (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-[var(--ink-2)] uppercase tracking-wider px-1">
                Elenco Operatori e Link d&apos;Accesso
              </h4>

              {loadingOperators ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--bg)]" />
                  ))}
                </div>
              ) : operators.length === 0 ? (
                <p className="text-xs text-[var(--ink-2)] italic px-1 text-center py-6">
                  Nessun operatore configurato per questa attività. L&apos;attività deve prima registrarli dalle sue impostazioni.
                </p>
              ) : (
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1 no-scrollbar">
                  {operators.map((op) => {
                    const opLink = `${typeof window !== "undefined" ? window.location.origin : ""}/op/${op.access_token}`;
                    return (
                      <div key={op.id} className="ios-card p-3.5 border border-[var(--line)] space-y-2.5 bg-[var(--surface)]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ background: op.color }} />
                            <span className="font-bold text-sm text-[var(--ink)]">{op.name}</span>
                          </div>
                          {!op.active && (
                            <span className="text-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--ink-2)] px-1.5 py-0.5 rounded font-bold">Disattivato</span>
                          )}
                        </div>

                        {/* Link copying / regenerating row */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={opLink}
                            className="text-xs font-mono h-9 flex-1 py-0 px-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl opacity-85 select-all outline-none focus:border-[var(--ink)] text-[var(--ink)] font-medium"
                          />
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(opLink);
                                setCopiedOpId(op.id);
                                setTimeout(() => setCopiedOpId(null), 1500);
                              } catch {}
                            }}
                            className="h-9 px-4 rounded-full border border-[var(--line)] hover:bg-[var(--bg)] active:scale-95 transition-all text-xs font-bold text-[var(--ink)] shrink-0 cursor-pointer bg-[var(--surface)]"
                          >
                            {copiedOpId === op.id ? "Copiato!" : "Copia"}
                          </button>
                          <button
                            onClick={() => handleRegenerateToken(op.id)}
                            disabled={regeneratingId === op.id}
                            className="h-9 px-4 rounded-full border border-[#ba1a1a]/30 text-[#ba1a1a] hover:bg-[#ba1a1a]/5 active:scale-95 transition-all text-xs font-bold shrink-0 cursor-pointer bg-transparent"
                            title="Rigenera Token / Cambia Link"
                          >
                            {regeneratingId === op.id ? "..." : "Rigenera"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 px-4">
              <span className="material-symbols-outlined text-[48px] text-[var(--ink-2)] opacity-40 mb-2 block">lock</span>
              <p className="text-xs text-[var(--ink-2)] font-medium max-w-xs mx-auto">
                Abilita il toggle sopra per visualizzare i link di accesso dei singoli operatori ed inviarli allo staff.
              </p>
            </div>
          )}

          <div className="flex justify-center pt-2 border-t border-[var(--line)]">
            <button
              onClick={() => setActiveBiz(null)}
              className="text-xs font-bold text-[var(--ink-2)] uppercase tracking-wider cursor-pointer hover:opacity-85 border-none bg-transparent"
            >
              Chiudi
            </button>
          </div>
        </div>
      </Sheet>
    </main>
  );
}
