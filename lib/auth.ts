import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export type Role = "admin" | "agent";

export type SessionUser = {
  id: number;
  username: string;
  role: Role;
};

const USERS: Record<string, { password: string; role: Role }> = {
  admin: { password: "admin123", role: "admin" },
  agent: { password: "agent123", role: "agent" }
};

const COOKIE_NAME = "contract_app_user";

export async function signIn(username: string, password: string) {
  const hardcoded = USERS[username];
  if (!hardcoded || hardcoded.password !== password) return null;

  const dbUser = await prisma.user.upsert({
    where: { username },
    update: { role: hardcoded.role, isActive: true },
    create: {
      username,
      role: hardcoded.role,
      isActive: true,
      passwordNote: `Mot de passe code en dur : ${password}`
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, username, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12
  });

  return { id: dbUser.id, username, role: hardcoded.role };
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const username = cookieStore.get(COOKIE_NAME)?.value;
  if (!username) return null;

  const hardcoded = USERS[username];
  if (!hardcoded) return null;

  const dbUser = await prisma.user.findUnique({ where: { username } });
  if (!dbUser || !dbUser.isActive) return null;

  return { id: dbUser.id, username, role: hardcoded.role };
}

export async function requireUser(role?: Role) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) redirect(user.role === "admin" ? "/admin/requests" : "/agent/requests");
  return user;
}

export function loginDestination(role: Role) {
  return role === "admin" ? "/admin/requests" : "/agent/requests";
}
