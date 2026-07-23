import Link from "next/link";

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
    <main className="mx-auto flex min-h-[100dvh] max-w-[440px] flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-[1.05rem] font-[640]">
        Prenota<span className="text-[var(--accent)]">Easy</span>
      </Link>
      <h1 className="text-title">{title}</h1>
      {subtitle && <p className="mt-2 text-[var(--ink-2)]">{subtitle}</p>}
      <div className="mt-7">{children}</div>
      {footer && <div className="mt-6 text-[var(--ink-2)]">{footer}</div>}
    </main>
  );
}
