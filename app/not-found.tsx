import Link from "next/link";
import { AppHeader, AppPageHeading } from "@/components/app/AppChrome";
export default function NotFound() {
  return <><AppHeader /><main className="app-status-page"><AppPageHeading eyebrow="Pagina non trovata" title="Torniamo all’inizio." description="Questo link non è disponibile. Puoi ripartire da qui." /><Link href="/" className="ios-btn-primary">Vai alla home</Link></main></>;
}
