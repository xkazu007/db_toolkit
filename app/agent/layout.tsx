import { requireUser } from "@/lib/auth";
import { AgentNav } from "./AgentNav";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("agent");

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Modifications</div>
        <AgentNav username={user.username} />
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
