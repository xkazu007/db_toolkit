"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";

const links = [
  { href: "/agent/requests", label: "Mes demandes", exact: true },
  { href: "/agent/requests/new", label: "Nouvelle demande" }
];

export function AgentNav({ username }: { username: string }) {
  const pathname = usePathname();

  return (
    <div className="side-content">
      <nav className="nav" aria-label="Navigation agent">
        {links.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link className={active ? "active" : ""} href={link.href} key={link.href}>
              {link.label}
            </Link>
          );
        })}
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
