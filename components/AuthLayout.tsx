import Link from "next/link";
import { AppHeader } from "@/components/app/AppChrome";
import "@/app/access-design.css";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="access-page">
      <AppHeader backHref="/">
        <Link href="/" className="access-home-link">Torna al sito</Link>
      </AppHeader>
      <main className="access-layout">
        <aside className="access-editorial" aria-label="Il tuo spazio, il tuo ritmo">
          <img src="/images/salon-editorial.jpg" alt="Un salone luminoso, pronto per una nuova giornata" />
          <div className="access-editorial-copy">
            <span className="access-eyebrow">Il tuo spazio, il tuo ritmo</span>
            <p>Più tempo<br />per il tuo talento.</p>
          </div>
        </aside>
        <section className="access-card">
          <span className="access-eyebrow">Benvenuto in PrenotaEasy</span>
          <h1>{title}</h1>
          {subtitle && <p className="access-description">{subtitle}</p>}
          <div className="access-form-content">{children}</div>
          {footer && <div className="access-footer">{footer}</div>}
        </section>
      </main>
    </div>
  );
}
