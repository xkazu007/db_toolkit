"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { updateTargetContract } from "@/lib/target-db";
import { prisma } from "@/lib/prisma";

export async function approveRequestAction(formData: FormData) {
  const user = await requireUser("admin");
  const id = Number(formData.get("id"));
  await approveOne(id, user.id);
  revalidatePath("/admin/requests");
  redirect(`/admin/requests/${id}`);
}

export async function rejectRequestAction(formData: FormData) {
  const user = await requireUser("admin");
  const id = Number(formData.get("id"));
  const request = await prisma.modificationRequest.update({
    where: { id, status: "pending" },
    data: { status: "rejected", rejectedAt: new Date(), approvedByUserId: user.id }
  });
  await auditLog({ actorUserId: user.id, action: "request_rejected", requestId: id, details: { contractNumber: request.contractNumber } });
  revalidatePath("/admin/requests");
  redirect(`/admin/requests/${id}`);
}

export async function approveSelectedAction(formData: FormData) {
  const user = await requireUser("admin");
  const ids = formData.getAll("requestId").map((value) => Number(value)).filter(Boolean);
  let approved = 0;
  let failed = 0;

  for (const id of ids) {
    const result = await approveOne(id, user.id);
    if (result) approved += 1;
    else failed += 1;
  }

  revalidatePath("/admin/requests");
  const status = failed > 0 ? "failed" : "pending";
  redirect(`/admin/requests?status=${status}&summary=approuvees:${approved},echouees:${failed}`);
}

export async function approveAllAction() {
  const user = await requireUser("admin");
  const pending = await prisma.modificationRequest.findMany({ where: { status: "pending" }, select: { id: true } });
  let approved = 0;
  let failed = 0;

  for (const item of pending) {
    const result = await approveOne(item.id, user.id);
    if (result) approved += 1;
    else failed += 1;
  }

  revalidatePath("/admin/requests");
  const status = failed > 0 ? "failed" : "pending";
  redirect(`/admin/requests?status=${status}&summary=approuvees:${approved},echouees:${failed}`);
}

async function approveOne(id: number, actorUserId: number) {
  const request = await prisma.modificationRequest.findUnique({
    where: { id },
    include: { items: true }
  });

  if (!request || request.status !== "pending") return false;

  const allowedColumns = await prisma.fieldMapping.findMany({
    where: { dbColumn: { in: request.items.map((item) => item.dbColumnSnapshot) } },
    select: { dbColumn: true }
  });
  const allowed = new Set(allowedColumns.map((item) => item.dbColumn));
  const updates = request.items.map((item) => ({ dbColumn: item.dbColumnSnapshot, value: item.newValue }));

  if (updates.some((item) => !allowed.has(item.dbColumn))) {
    await markFailed(id, actorUserId, "La demande contient une colonne DB2 qui n'est plus autorisee.");
    return false;
  }

  const result = await updateTargetContract({ contractNumber: request.contractNumber, updates });
  if (!result.ok) {
    await markFailed(id, actorUserId, result.error || "La mise a jour a echoue.");
    return false;
  }

  await prisma.modificationRequest.update({
    where: { id },
    data: { status: "approved", approvedAt: new Date(), approvedByUserId: actorUserId, failureReason: null }
  });
  await auditLog({
    actorUserId,
    action: "request_approved",
    requestId: id,
    details: { rowsAffected: result.rowsAffected, sql: result.sql }
  });
  return true;
}

async function markFailed(id: number, actorUserId: number, reason: string) {
  await prisma.modificationRequest.update({
    where: { id },
    data: { status: "failed", approvedByUserId: actorUserId, failureReason: reason }
  });
  await auditLog({ actorUserId, action: "request_failed", requestId: id, details: { reason } });
}
