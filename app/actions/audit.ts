"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function clearErrorsAction() {
  const user = await requireUser("admin");
  const result = await prisma.modificationRequest.updateMany({
    where: { status: "failed", failureReason: { not: null } },
    data: { failureReason: null }
  });

  await auditLog({
    actorUserId: user.id,
    action: "errors_cleared",
    details: { count: result.count }
  });

  revalidatePath("/admin/audit");
  revalidatePath("/admin/requests");
  redirect("/admin/audit?action=errors_cleared");
}
