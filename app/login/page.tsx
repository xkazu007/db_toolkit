"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(loginAction, null);

  return (
    <main className="login-page">
      <form className="login-box grid" action={formAction}>
        <div>
          <p className="eyebrow">Application interne locale</p>
          <h1>Modifications de contrats</h1>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <label>
          Identifiant
          <input name="username" autoComplete="username" required />
        </label>
        <label>
          Mot de passe
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button disabled={pending}>{pending ? "Connexion..." : "Se connecter"}</button>
        <p className="hint">Comptes : admin/admin123 ou agent/agent123.</p>
      </form>
    </main>
  );
}
