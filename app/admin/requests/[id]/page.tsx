import { notFound } from "next/navigation";
import { approveRequestAction, rejectRequestAction, retryFailedRequestAction } from "@/app/actions/requests";
import { buildFilledTargetUpdatePreview } from "@/lib/target-db";
import { formatDate, statusClass, statusLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AdminRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = await prisma.modificationRequest.findUnique({
    where: { id: Number(id) },
    include: { requestedBy: true, approvedBy: true, items: true }
  });

  if (!request) notFound();
  const sqlPreview = buildFilledTargetUpdatePreview({
    contractNumber: request.contractNumber,
    updates: request.items.map((item) => ({ dbColumn: item.dbColumnSnapshot, value: item.newValue }))
  });

  return (
    <>
      <div className="topbar">
        <div>
          <p className="eyebrow">Demande #{request.id}</p>
          <h1>{request.contractNumber}</h1>
        </div>
        <span className={statusClass(request.status)}>{statusLabel(request.status)}</span>
      </div>

      <section className="panel grid two">
        <div>
          <p className="eyebrow">Demande par</p>
          <strong>{request.requestedBy.username}</strong>
        </div>
        <div>
          <p className="eyebrow">Creee le</p>
          <strong>{formatDate(request.createdAt)}</strong>
        </div>
        <div>
          <p className="eyebrow">Commentaire</p>
          <strong>{request.comment || "-"}</strong>
        </div>
        <div>
          <p className="eyebrow">Echec</p>
          <strong>{request.failureReason || "-"}</strong>
        </div>
      </section>

      <table>
        <thead>
          <tr>
            <th>Libelle</th>
            <th>Colonne DB2</th>
            <th>Nouvelle valeur</th>
          </tr>
        </thead>
        <tbody>
          {request.items.map((item) => (
            <tr key={item.id}>
              <td>{item.labelSnapshot}</td>
              <td>{item.dbColumnSnapshot}</td>
              <td>{item.newValue || "(champ vide)"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="panel grid" style={{ marginTop: 18 }}>
        <h2>SQL genere</h2>
        <code className="sql-preview">{sqlPreview}</code>
        <p className="hint">Apercu lisible. L'execution utilise toujours des parametres securises.</p>
      </section>

      {request.status === "pending" ? (
        <div className="actions" style={{ marginTop: 18 }}>
          <form action={approveRequestAction}>
            <input type="hidden" name="id" value={request.id} />
            <button type="submit">Approuver</button>
          </form>
          <form action={rejectRequestAction}>
            <input type="hidden" name="id" value={request.id} />
            <button className="danger" type="submit">Rejeter</button>
          </form>
        </div>
      ) : null}

      {request.status === "failed" ? (
        <div className="actions" style={{ marginTop: 18 }}>
          <form action={retryFailedRequestAction}>
            <input type="hidden" name="id" value={request.id} />
            <button type="submit">Relancer la demande</button>
          </form>
        </div>
      ) : null}
    </>
  );
}
