"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function saveUserAction(formData: FormData) {
  const actor = await requireUser("admin");
  const id = Number(formData.get("id"));
  const data = {
    username: String(formData.get("username") || "").trim(),
    role: String(formData.get("role") || "agent"),
    isActive: formData.get("isActive") === "on",
    passwordNote: String(formData.get("passwordNote") || "").trim() || null
  };

  if (!data.username) redirect("/admin/users?error=missing");

  const user = id
    ? await prisma.user.update({ where: { id }, data })
    : await prisma.user.create({ data });

  await auditLog({ actorUserId: actor.id, action: id ? "user_edited" : "user_created", details: { id: user.id, username: user.username } });
  revalidatePath("/admin/users");
  redirect("/admin/users");
}
