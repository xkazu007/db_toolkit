"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { disableBridgeAction, enableBridgeAction } from "@/app/actions/bridge";

const links = [
  { href: "/admin/requests", label: "Demandes" },
  { href: "/admin/database", label: "Base cible" },
  { href: "/admin/mappings", label: "Champs" },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/audit", label: "Journal d'audit" }
];

type BridgeStatus = {
  ok: boolean;
  enabled: boolean;
  pooling: boolean;
  error?: string;
};

export function AdminNav({ username, bridgeStatus }: { username: string; bridgeStatus: BridgeStatus }) {
  const pathname = usePathname();

  return (
    <div className="side-content">
      <div className="nav-stack">
        <nav className="nav" aria-label="Navigation administrateur">
          {links.map((link) => (
            <Link className={pathname.startsWith(link.href) ? "active" : ""} href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={`bridge-box ${bridgeStatus.enabled ? "is-on" : "is-off"}`}>
          <div>
            <p className="account-label">Acces IBM</p>
            <strong>{bridgeStatus.ok ? (bridgeStatus.enabled ? "Active" : "Desactive") : "Injoignable"}</strong>
          </div>
          {bridgeStatus.enabled ? (
            <form action={disableBridgeAction}>
              <input type="hidden" name="returnTo" value={pathname} />
              <button className="logout danger-toggle" type="submit">Couper l'acces</button>
            </form>
          ) : (
            <form action={enableBridgeAction}>
              <input type="hidden" name="returnTo" value={pathname} />
              <button className="logout" type="submit">Activer l'acces</button>
            </form>
          )}
        </div>
      </div>

      <div className="account-box">
        <div>
          <p className="account-label">Connecte en tant que</p>
          <strong>{username}</strong>
        </div>
        <form action={logoutAction}>
          <button className="logout">Se deconnecter</button>
        </form>
      </div>
    </div>
  );
}
