import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function redirectTo(path: string, request: Request) {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return redirectTo("/login", request);
  if (user.role !== "agent") return redirectTo("/admin/requests", request);

  const formData = await request.formData();
  const contractNumber = String(formData.get("contractNumber") || "").trim();
  const comment = String(formData.get("comment") || "").trim();
  const mappingIds = formData.getAll("mappingId").map((value) => Number(value));
  const values = formData.getAll("newValue").map((value) => String(value).trim());

  const rows = mappingIds
    .map((mappingId, index) => ({ mappingId, newValue: values[index] }))
    .filter((row) => row.mappingId);

  const uniqueMappingIds = new Set(rows.map((row) => row.mappingId));
  if (!contractNumber || rows.length === 0 || uniqueMappingIds.size !== rows.length) {
    return redirectTo("/agent/requests/new?error=invalid", request);
  }

  const mappings = await prisma.fieldMapping.findMany({
    where: {
      id: { in: rows.map((row) => row.mappingId) },
      OR: [{ isActive: true }, { dbColumn: "NODOSS" }]
    }
  });

  if (mappings.length !== rows.length) {
    return redirectTo("/agent/requests/new?error=invalid", request);
  }

  const createdRequest = await prisma.modificationRequest.create({
    data: {
      contractNumber,
      comment: comment || null,
      requestedByUserId: user.id,
      items: {
        create: rows.map((row) => {
          const mapping = mappings.find((item) => item.id === row.mappingId);
          if (!mapping) throw new Error("Mapping introuvable");
          return {
            fieldMappingId: mapping.id,
            labelSnapshot: mapping.label,
            dbColumnSnapshot: mapping.dbColumn,
            newValue: row.newValue
          };
        })
      }
    }
  });

  await auditLog({
    actorUserId: user.id,
    action: "request_created",
    requestId: createdRequest.id,
    details: { contractNumber, itemCount: rows.length }
  });

  revalidatePath("/agent/requests");
  return redirectTo("/agent/requests", request);
}
