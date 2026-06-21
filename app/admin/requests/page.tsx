import Link from "next/link";
import { approveAllAction, approveSelectedAction } from "@/app/actions/requests";
import { formatDate, statusClass, statusLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AdminRequestsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; summary?: string }>;
}) {
  const params = await searchParams;
  const status = params.status || "pending";
  const requests = await prisma.modificationRequest.findMany({
    where: status === "all" ? {} : { status },
    include: { requestedBy: true, items: true },
    orderBy: { createdAt: "desc" }
  });
  const summary = params.summary
    ?.replace("approved", "approuvees")
    .replace("failed", "echouees")
    .replace(",", ", ");

  return (
    <>
      <div className="topbar">
        <div>
          <p className="eyebrow">Espace administrateur</p>
          <h1>Demandes</h1>
        </div>
        <form action={approveAllAction}>
          <button type="submit">Approuver toutes les demandes en attente</button>
        </form>
      </div>

      {summary ? <p className="panel">Approbation en lot terminee : {summary}</p> : null}

      <div className="panel actions">
        {["pending", "approved", "rejected", "failed", "all"].map((item) => (
          <Link className={`button ${item === status ? "" : "secondary"}`} key={item} href={`/admin/requests?status=${item}`}>
            {statusLabel(item)}
          </Link>
        ))}
      </div>

      <form action={approveSelectedAction}>
        <table>
          <thead>
            <tr>
              <th>Selection</th>
              <th>ID</th>
              <th>NODOSS</th>
              <th>Demande par</th>
              <th>Statut</th>
              <th>Champs</th>
              <th>Creee le</th>
              <th>Erreur</th>
              <th>Ouvrir</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>
                  {request.status === "pending" ? <input type="checkbox" name="requestId" value={request.id} /> : "-"}
                </td>
                <td>#{request.id}</td>
                <td>{request.contractNumber}</td>
                <td>{request.requestedBy.username}</td>
                <td><span className={statusClass(request.status)}>{statusLabel(request.status)}</span></td>
                <td>{request.items.length}</td>
                <td>{formatDate(request.createdAt)}</td>
                <td className="failure-cell">{request.failureReason || "-"}</td>
                <td><Link href={`/admin/requests/${request.id}`}>Revoir</Link></td>
              </tr>
            ))}
            {requests.length === 0 ? (
              <tr>
                <td colSpan={9}>Aucune demande pour ce filtre.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="actions" style={{ marginTop: 14 }}>
          <button type="submit">Approuver la selection</button>
        </div>
      </form>
    </>
  );
}
