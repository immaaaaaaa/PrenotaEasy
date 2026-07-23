"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("La password deve avere almeno 6 caratteri.");
      return;
    }
    setLoading(true);
    setError(null);
    const supa = createClient();
    const { data, error } = await supa.auth.signUp({ email, password });
    if (error) {
      setError(
        error.message.includes("registered")
          ? "Questa email è già registrata."
          : "Registrazione non riuscita. Riprova.",
      );
      setLoading(false);
      return;
    }
    // If email confirmation is on, there's no session yet.
    if (!data.session) {
      setCheckEmail(true);
      setLoading(false);
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  if (checkEmail) {
    return (
      <div className="rounded-[var(--r-lg)] bg-[var(--surface-2)] p-5 text-center">
        <div className="mb-2 text-3xl">📬</div>
        <p className="font-[560]">Controlla la tua email</p>
        <p className="mt-1 text-[0.92rem] text-[var(--ink-2)]">
          Ti abbiamo inviato un link per confermare l&apos;account. Dopo la
          conferma potrai accedere.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
        className="input"
      />
      <input
        type="password"
        placeholder="Password (min. 6 caratteri)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        required
        className="input"
      />
      {error && <p className="px-1 text-[0.9rem] text-[var(--danger)]">{error}</p>}
      <Button type="submit" size="lg" fullWidth loading={loading}>
        Crea account
      </Button>
    </form>
  );
}
