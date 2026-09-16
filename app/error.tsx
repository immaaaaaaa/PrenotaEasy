"use client";
import Link from "next/link";
import { AppHeader, AppPageHeading } from "@/components/app/AppChrome";
import { Button } from "@/components/ui/Button";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <><AppHeader /><main className="app-status-page"><AppPageHeading eyebrow="Un piccolo imprevisto" title="Riproviamo." description="Non siamo riusciti a caricare questa pagina." /><div className="flex flex-wrap gap-4"><Button onClick={reset}>Riprova</Button><Link href="/" className="ios-btn-secondary">Vai alla home</Link></div></main></>;
}
