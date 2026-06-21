import Link from "next/link";
import { clearErrorsAction } from "@/app/actions/audit";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const filters = [
  { value: "all", label: "Tout" },
  { value: "request_failed", label: "Erreurs" },
  { value: "request_approved", label: "Approbations" },
  { value: "request_rejected", label: "Rejets" },
  { value: "user_logged_in", label: "Connexions" },
  { value: "mapping", label: "Champs" },
  { value: "user", label: "Utilisateurs" },
  { value: "errors_cleared", label: "Erreurs effacees" }
];

export default async function AdminAuditPage({
  searchParams
}: {
  searchParams: Promise<{ action?: string; requestId?: string }>;
}) {
  const params = await searchParams;
  const action = params.action || "all";
  const requestId = params.requestId ? Number(params.requestId) : undefined;
  const actionWhere =
    action === "all"
      ? {}
      : action === "mapping"
        ? { action: { in: ["mapping_created", "mapping_edited"] } }
        : action === "user"
          ? { action: { in: ["user_created", "user_edited"] } }
          : { action };

  const logs = await prisma.auditLog.findMany({
    where: {
      ...actionWhere,
      ...(requestId ? { requestId } : {})
    },
    include: { actor: true, request: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const recentFailures = await prisma.modificationRequest.findMany({
    where: { status: "failed", failureReason: { not: null } },
    include: { requestedBy: true },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  return (
    <>
      <div className="topbar">
        <div>
          <p className="eyebrow">Espace administrateur</p>
          <h1>Journal d'audit</h1>
        </div>
        <form action={clearErrorsAction}>
          <button className="danger" type="submit">Effacer les erreurs</button>
        </form>
      </div>

      {recentFailures.length > 0 ? (
        <section className="panel grid">
          <h2>Dernieres erreurs</h2>
          {recentFailures.map((request) => (
            <div className="error-row" key={request.id}>
              <div>
                <strong>Demande #{request.id} - NODOSS {request.contractNumber}</strong>
                <p>{request.failureReason || "Erreur inconnue."}</p>
              </div>
              <Link href={`/admin/requests/${request.id}`}>Voir</Link>
            </div>
          ))}
        </section>
      ) : null}

      <section className="panel grid">
        <div className="actions">
          {filters.map((filter) => (
            <Link
              className={`button ${filter.value === action ? "" : "secondary"}`}
              href={`/admin/audit?action=${filter.value}`}
              key={filter.value}
            >
              {filter.label}
            </Link>
          ))}
        </div>
        <form className="actions" action="/admin/audit">
          <input type="hidden" name="action" value={action} />
          <label className="inline-filter">
            Demande #
            <input name="requestId" defaultValue={params.requestId || ""} inputMode="numeric" placeholder="ex: 12" />
          </label>
          <button type="submit">Filtrer</button>
          {params.requestId ? <Link className="button secondary" href={`/admin/audit?action=${action}`}>Retirer</Link> : null}
        </form>
      </section>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Acteur</th>
            <th>Action</th>
            <th>Demande</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{formatDate(log.createdAt)}</td>
              <td>{log.actor?.username || "-"}</td>
              <td>{log.action}</td>
              <td>{log.requestId ? `#${log.requestId}` : "-"}</td>
              <td><code>{log.detailsJson || "-"}</code></td>
            </tr>
          ))}
          {logs.length === 0 ? (
            <tr>
              <td colSpan={5}>Aucun evenement d'audit.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
