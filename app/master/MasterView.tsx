"use client";

import { useState, useTransition, useEffect } from "react";
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
import { AppHeader, AppPageHeading } from "@/components/app/AppChrome";
import type { Employee } from "@/lib/types";

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
  const [operators, setOperators] = useState<Pick<Employee, "id" | "name" | "color" | "active" | "access_token">[]>([]);
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
    <>
      <AppHeader>
        <Button variant="ghost" disabled={logoutPending} onClick={() => startLogout(async () => { await logout(); })}>
          <span className="material-symbols-outlined" aria-hidden="true">logout</span>
          {logoutPending ? "Uscita…" : "Esci"}
        </Button>
      </AppHeader>
      <main className="management-page master-page">
        <AppPageHeading eyebrow="AMMINISTRAZIONE" title="Ogni attività. Sotto controllo." description="Gestisci i saloni e gli accessi da un unico posto.">
          <Button size="lg" onClick={() => setIsOpen(true)}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            Nuova attività
          </Button>
        </AppPageHeading>
        <section className="management-metrics" aria-label="Riepilogo attività">
          {[
            { label: "Attività registrate", value: total, icon: "storefront" },
            { label: "Configurate", value: onboarded, icon: "check_circle" },
            { label: "Da configurare", value: pendingOnboarding, icon: "hourglass_top" },
          ].map((metric) => (
            <div key={metric.label} className="management-metric">
              <span className="material-symbols-outlined management-metric-icon" aria-hidden="true">{metric.icon}</span>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </section>
        <section className="management-section" aria-labelledby="activities-title">
          <div className="management-section-heading">
            <h2 id="activities-title">I tuoi saloni.</h2>
            <p>{total} {total === 1 ? "attività registrata" : "attività registrate"}</p>
          </div>
          <div className="activity-grid">
            {activities.length === 0 ? (
              <div className="management-empty">
                <span className="material-symbols-outlined" aria-hidden="true">storefront</span>
                <h3>Il primo salone parte da qui.</h3>
                <p>Crea un’attività e assegna le credenziali al suo proprietario.</p>
                <Button onClick={() => setIsOpen(true)}>Crea un’attività</Button>
              </div>
            ) : activities.map((activity) => (
              <article key={activity.id} className="activity-card">
                <div className="activity-card-heading">
                  <span className="activity-symbol material-symbols-outlined" aria-hidden="true">storefront</span>
                  <span className={`management-status ${activity.onboarded ? "is-ready" : "is-pending"}`}>
                    <span aria-hidden="true" />{activity.onboarded ? "Configurata" : "Da configurare"}
                  </span>
                </div>
                <h3>{activity.name}</h3>
                <dl className="activity-details">
                  <div><dt>Pagina pubblica</dt><dd>/b/{activity.slug}</dd></div>
                  <div><dt>Proprietario</dt><dd>{activity.owner_email || "Nessun proprietario"}</dd></div>
                </dl>
                <div className="activity-actions">
                  <a href={`/b/${activity.slug}`} target="_blank" rel="noreferrer" className="management-action">
                    Pagina<span className="material-symbols-outlined" aria-hidden="true">north_east</span>
                    <span className="sr-only"> di {activity.name}, si apre in una nuova scheda</span>
                  </a>
                  <Button variant="secondary" onClick={() => setActiveBiz(activity)}>
                    <span className="material-symbols-outlined" aria-hidden="true">group</span>Operatori
                  </Button>
                  <button type="button" className="management-action management-action-danger" onClick={() => handleDelete(activity.id, activity.owner_id)} disabled={isDeletingId === activity.id} aria-label={`Elimina ${activity.name}`}>
                    {isDeletingId === activity.id ? "Eliminazione…" : "Elimina"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Sheet open={isOpen} onClose={() => setIsOpen(false)} title="Nuova attività">
        <form onSubmit={handleCreate} className="management-form">
          <p className="management-sheet-intro">Prepara l’accesso per un nuovo salone. Il proprietario completerà la configurazione.</p>
          <div className="management-field">
            <label htmlFor="activity-name">Nome dell’attività</label>
            <input id="activity-name" type="text" required autoComplete="organization" placeholder="Salone Giulia" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="management-field">
            <label htmlFor="activity-slug">Indirizzo della pagina</label>
            <input id="activity-slug" type="text" required autoCapitalize="none" spellCheck={false} placeholder="salone-giulia" value={slug} onChange={(event) => setSlug(event.target.value)} aria-describedby="activity-slug-hint" />
            <p id="activity-slug-hint">Il link pubblico termina con /b/{slug || "nome-salone"}.</p>
          </div>
          <div className="management-field">
            <label htmlFor="activity-email">Email del proprietario</label>
            <input id="activity-email" type="email" required autoComplete="email" placeholder="giulia@email.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="management-field">
            <label htmlFor="activity-password">Password iniziale</label>
            <input id="activity-password" type="password" required minLength={6} autoComplete="new-password" placeholder="Almeno 6 caratteri" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {error && <p className="management-error" role="alert">{error}</p>}
          <div className="management-form-actions">
            <Button type="submit" size="lg" fullWidth disabled={pending}>{pending ? "Creazione…" : "Crea attività"}</Button>
            <Button type="button" variant="ghost" fullWidth onClick={() => setIsOpen(false)}>Annulla</Button>
          </div>
        </form>
      </Sheet>
      <Sheet open={!!activeBiz} onClose={() => setActiveBiz(null)} title={activeBiz ? `Operatori · ${activeBiz.name}` : "Operatori"}>
        <div className="operator-management">
          <div className="operator-access-setting">
            <div>
              <span className="management-eyebrow">ACCESSI INDIVIDUALI</span>
              <h3 id="operator-access-label">Pagine operatore</h3>
              <p id="operator-access-description">Un link personale per consultare la propria agenda.</p>
            </div>
            <button type="button" role="switch" aria-checked={!!activeBiz?.operator_pages_enabled} aria-labelledby="operator-access-label" aria-describedby="operator-access-description" disabled={togglingPremium} onClick={() => handleTogglePremium(!activeBiz?.operator_pages_enabled)} className="management-switch">
              <span />
            </button>
          </div>
          {activeBiz?.operator_pages_enabled ? (
            <section aria-labelledby="operator-links-title" aria-busy={loadingOperators}>
              <div className="management-section-heading"><h3 id="operator-links-title">Link del team</h3></div>
              {loadingOperators ? (
                <div className="management-empty" role="status"><p>Caricamento operatori…</p></div>
              ) : operators.length === 0 ? (
                <div className="management-empty"><p>Nessun operatore configurato. Il salone può aggiungerli dalle impostazioni.</p></div>
              ) : (
                <div className="operator-link-list">
                  {operators.map((operator) => {
                    const operatorLink = `${typeof window !== "undefined" ? window.location.origin : ""}/op/${operator.access_token}`;
                    return (
                      <article key={operator.id} className="operator-link-card">
                        <div className="operator-link-heading">
                          <h4><span className="operator-color" style={{ background: operator.color }} aria-hidden="true" />{operator.name}</h4>
                          {!operator.active && <span className="management-status">Disattivato</span>}
                        </div>
                        <label className="sr-only" htmlFor={`operator-link-${operator.id}`}>Link di accesso di {operator.name}</label>
                        <input id={`operator-link-${operator.id}`} type="text" readOnly value={operatorLink} onFocus={(event) => event.target.select()} />
                        <div className="operator-link-actions">
                          <Button variant="secondary" onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(operatorLink);
                              setCopiedOpId(operator.id);
                              setTimeout(() => setCopiedOpId(null), 1500);
                            } catch { alert("Impossibile copiare il link. Selezionalo e copialo manualmente."); }
                          }}>
                            <span className="material-symbols-outlined" aria-hidden="true">{copiedOpId === operator.id ? "check" : "content_copy"}</span>
                            {copiedOpId === operator.id ? "Copiato!" : "Copia link"}
                          </Button>
                          <button type="button" className="management-action management-action-danger" disabled={regeneratingId === operator.id} onClick={() => handleRegenerateToken(operator.id)}>
                            {regeneratingId === operator.id ? "Rigenerazione…" : "Rigenera link"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ) : (
            <div className="management-empty">
              <span className="material-symbols-outlined" aria-hidden="true">lock</span>
              <p>Attiva le pagine operatore per visualizzare e condividere i link personali con il team.</p>
            </div>
          )}
          <Button variant="ghost" fullWidth onClick={() => setActiveBiz(null)}>Chiudi</Button>
        </div>
      </Sheet>
    </>
  );
}
