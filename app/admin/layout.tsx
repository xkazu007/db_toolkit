import { getBridgeStatus } from "@/app/actions/bridge";
import { requireUser } from "@/lib/auth";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("admin");
  const bridgeStatus = await getBridgeStatus();

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Modifications</div>
        <AdminNav username={user.username} bridgeStatus={bridgeStatus} />
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
