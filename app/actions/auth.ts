"use server";

import { redirect } from "next/navigation";
import { auditLog } from "@/lib/audit";
import { loginDestination, signIn, signOut } from "@/lib/auth";

export async function loginAction(_prev: string | null, formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const user = await signIn(username, password);

  if (!user) return "Identifiant ou mot de passe incorrect.";

  await auditLog({ actorUserId: user.id, action: "user_logged_in", details: { username } });
  redirect(loginDestination(user.role));
}

export async function logoutAction() {
  await signOut();
  redirect("/login");
}
