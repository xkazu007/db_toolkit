import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate, statusClass, statusLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AgentRequestsPage() {
  const user = await requireUser("agent");
  const requests = await prisma.modificationRequest.findMany({
    where: { requestedByUserId: user.id },
    include: { items: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <>
      <div className="topbar">
        <div>
          <p className="eyebrow">Espace agent</p>
          <h1>Mes demandes</h1>
        </div>
        <Link className="button" href="/agent/requests/new">Nouvelle demande</Link>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Num contrat</th>
            <th>Statut</th>
            <th>Champs</th>
            <th>Creee le</th>
            <th>Echec</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td>#{request.id}</td>
              <td>{request.contractNumber}</td>
              <td><span className={statusClass(request.status)}>{statusLabel(request.status)}</span></td>
              <td>{request.items.length}</td>
              <td>{formatDate(request.createdAt)}</td>
              <td>{request.failureReason || "-"}</td>
            </tr>
          ))}
          {requests.length === 0 ? (
            <tr>
              <td colSpan={6}>Aucune demande pour le moment.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
