"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";

const links = [
  { href: "/admin/requests", label: "Demandes" },
  { href: "/admin/database", label: "Base cible" },
  { href: "/admin/mappings", label: "Champs" },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/audit", label: "Journal d'audit" }
];

export function AdminNav({ username }: { username: string }) {
  const pathname = usePathname();

  return (
    <div className="side-content">
      <nav className="nav" aria-label="Navigation administrateur">
        {links.map((link) => (
          <Link className={pathname.startsWith(link.href) ? "active" : ""} href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>

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
