import { prisma } from "@/lib/prisma";
import { ModificationRows } from "./ModificationRows";

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const mappings = await prisma.fieldMapping.findMany({
    where: { OR: [{ isActive: true }, { dbColumn: "NODOSS" }] },
    select: { id: true, label: true, helpText: true },
    orderBy: { label: "asc" }
  });

  return (
    <>
      <div className="topbar">
        <div>
          <p className="eyebrow">Espace agent</p>
          <h1>Nouvelle demande de modification</h1>
        </div>
      </div>

      {params.error ? <p className="error">Verifiez le num contrat, les lignes de modification et les champs en double.</p> : null}

      <form action="/agent/requests/create" method="post" className="grid">
        <section className="panel grid two">
          <label>
            Num contrat actuel
            <input name="contractNumber" placeholder="1045810" required />
          </label>
          <label>
            Commentaire
            <input name="comment" placeholder="Contexte optionnel pour l'administrateur" />
          </label>
        </section>

        <ModificationRows mappings={mappings} />

        <div className="actions">
          <button type="submit">Soumettre la demande</button>
        </div>
      </form>
    </>
  );
}
