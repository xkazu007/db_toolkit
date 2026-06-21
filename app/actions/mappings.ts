"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function saveMappingAction(formData: FormData) {
  const user = await requireUser("admin");
  const id = Number(formData.get("id"));
  const data = {
    label: String(formData.get("label") || "").trim(),
    dbColumn: String(formData.get("dbColumn") || "").trim().toUpperCase(),
    dataType: String(formData.get("dataType") || "text"),
    isRequired: formData.get("isRequired") === "on",
    isActive: formData.get("isActive") === "on",
    validationRule: String(formData.get("validationRule") || "").trim() || null,
    helpText: String(formData.get("helpText") || "").trim() || null,
    adminNote: String(formData.get("adminNote") || "").trim() || null
  };

  if (!data.label || !data.dbColumn) redirect("/admin/mappings?error=missing");

  const mapping = id
    ? await prisma.fieldMapping.update({ where: { id }, data })
    : await prisma.fieldMapping.create({ data });

  await auditLog({ actorUserId: user.id, action: id ? "mapping_edited" : "mapping_created", details: mapping });
  revalidatePath("/admin/mappings");
  redirect("/admin/mappings");
}
