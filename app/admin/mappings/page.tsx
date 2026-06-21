import { saveMappingAction } from "@/app/actions/mappings";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AdminMappingsPage() {
  const mappings = await prisma.fieldMapping.findMany({ orderBy: { label: "asc" } });

  return (
    <>
      <div className="topbar">
        <div>
          <p className="eyebrow">Espace administrateur</p>
          <h1>Champs modifiables</h1>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Libelle</th>
            <th>Colonne DB2</th>
            <th>Obligatoire</th>
            <th>Actif</th>
            <th>Mis a jour</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((mapping) => (
            <tr key={mapping.id}>
              <td>
                <details>
                  <summary>{mapping.label}</summary>
                  <div className="panel" style={{ marginTop: 10 }}>
                    <MappingForm mapping={mapping} />
                  </div>
                </details>
              </td>
              <td>{mapping.dbColumn}</td>
              <td>{mapping.isRequired ? "Oui" : "Non"}</td>
              <td>{mapping.isActive ? "Oui" : "Non"}</td>
              <td>{formatDate(mapping.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function MappingForm({
  mapping
}: {
  mapping?: {
    id: number;
    label: string;
    dbColumn: string;
    dataType: string;
    isRequired: boolean;
    isActive: boolean;
    validationRule: string | null;
    helpText: string | null;
    adminNote: string | null;
  };
}) {
  return (
    <form action={saveMappingAction} className="grid">
      <input type="hidden" name="id" value={mapping?.id || ""} />
      <input type="hidden" name="dataType" value={mapping?.dataType || "text"} />
      <input type="hidden" name="validationRule" value={mapping?.validationRule || ""} />
      <div className="grid two">
        <label>
          Libelle
          <input name="label" defaultValue={mapping?.label || ""} required />
        </label>
        <label>
          DB2 column
          <input name="dbColumn" defaultValue={mapping?.dbColumn || ""} required />
        </label>
      </div>
      <div className="grid two">
        <label>
          Aide pour l'agent
          <input name="helpText" defaultValue={mapping?.helpText || ""} />
        </label>
        <label>
          Note administrateur
          <input name="adminNote" defaultValue={mapping?.adminNote || ""} />
        </label>
      </div>
      <div className="actions">
        <label style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
          <input type="checkbox" name="isRequired" defaultChecked={mapping?.isRequired ?? true} style={{ width: "auto" }} />
          Obligatoire
        </label>
        <label style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
          <input type="checkbox" name="isActive" defaultChecked={mapping?.isActive ?? true} style={{ width: "auto" }} />
          Actif
        </label>
        <button type="submit">Enregistrer</button>
      </div>
    </form>
  );
}
