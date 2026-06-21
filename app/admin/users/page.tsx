import { saveUserAction } from "@/app/actions/users";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({ orderBy: { username: "asc" } });

  return (
    <>
      <div className="topbar">
        <div>
          <p className="eyebrow">Espace administrateur</p>
          <h1>Utilisateurs</h1>
        </div>
      </div>

      <section className="panel">
        <h2>Creer un utilisateur</h2>
        <UserForm />
        <p className="hint">L'authentification est volontairement codee en dur pour ce MVP. Seuls admin/admin123 et agent/agent123 peuvent se connecter.</p>
      </section>

      <table>
        <thead>
          <tr>
            <th>Identifiant</th>
            <th>Role</th>
            <th>Actif</th>
            <th>Note mot de passe</th>
            <th>Mis a jour</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <details>
                  <summary>{user.username}</summary>
                  <div className="panel" style={{ marginTop: 10 }}>
                    <UserForm user={user} />
                  </div>
                </details>
              </td>
              <td>{user.role}</td>
              <td>{user.isActive ? "Oui" : "Non"}</td>
              <td>{user.passwordNote || "-"}</td>
              <td>{formatDate(user.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function UserForm({
  user
}: {
  user?: { id: number; username: string; role: string; isActive: boolean; passwordNote: string | null };
}) {
  return (
    <form action={saveUserAction} className="grid">
      <input type="hidden" name="id" value={user?.id || ""} />
      <div className="grid two">
        <label>
          Identifiant
          <input name="username" defaultValue={user?.username || ""} required />
        </label>
        <label>
          Role
          <select name="role" defaultValue={user?.role || "agent"}>
            <option value="agent">agent</option>
            <option value="admin">admin</option>
          </select>
        </label>
      </div>
      <label>
        Note mot de passe/reinitialisation
        <input name="passwordNote" defaultValue={user?.passwordNote || ""} placeholder="Note auth codee en dur" />
      </label>
      <div className="actions">
        <label style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
          <input type="checkbox" name="isActive" defaultChecked={user?.isActive ?? true} style={{ width: "auto" }} />
          Actif
        </label>
        <button type="submit">{user ? "Enregistrer" : "Creer"}</button>
      </div>
    </form>
  );
}
