"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supa = createClient();
    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email o password non corretti.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="access-form">
      <label className="access-field">
        <span>Email</span>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
        className="input"
      />
      </label>
      <label className="access-field">
        <span>Password</span>
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
        className="input"
      />
      </label>
      {error && <p role="alert" className="access-error">{error}</p>}
      <Button type="submit" size="lg" fullWidth loading={loading}>
        Accedi
      </Button>
    </form>
  );
}
