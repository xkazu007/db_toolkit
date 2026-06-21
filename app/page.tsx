import { redirect } from "next/navigation";
import { getSessionUser, loginDestination } from "@/lib/auth";

export default async function HomePage() {
  const user = await getSessionUser();
  redirect(user ? loginDestination(user.role) : "/login");
}
