import { prisma } from "@/lib/prisma";

export async function auditLog(input: {
  actorUserId?: number;
  action: string;
  requestId?: number;
  details?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      requestId: input.requestId,
      detailsJson: input.details === undefined ? undefined : JSON.stringify(input.details)
    }
  });
}
