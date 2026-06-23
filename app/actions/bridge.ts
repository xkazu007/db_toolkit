"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

type BridgeStatus = {
  ok: boolean;
  enabled: boolean;
  pooling: boolean;
  error?: string;
};

function bridgeUrl() {
  return (process.env.BRIDGE_URL || "http://127.0.0.1:8001").replace(/\/$/, "");
}

export async function getBridgeStatus(): Promise<BridgeStatus> {
  try {
    const response = await fetch(`${bridgeUrl()}/control/status`, { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as Partial<BridgeStatus> & { detail?: string };
    if (!response.ok || payload.ok !== true) {
      return {
        ok: false,
        enabled: false,
        pooling: false,
        error: payload.error || payload.detail || `Bridge ODBC HTTP ${response.status}`
      };
    }

    return { ok: true, enabled: payload.enabled === true, pooling: payload.pooling === true };
  } catch (error) {
    return {
      ok: false,
      enabled: false,
      pooling: false,
      error: error instanceof Error ? error.message : "Bridge ODBC injoignable."
    };
  }
}

function safeReturnTo(value: FormDataEntryValue | null) {
  const path = String(value || "/admin/database");
  return path.startsWith("/admin") ? path : "/admin/database";
}

async function setBridgeEnabled(enabled: boolean, formData: FormData) {
  await requireUser("admin");
  const returnTo = safeReturnTo(formData.get("returnTo"));
  try {
    await fetch(`${bridgeUrl()}/control/${enabled ? "enable" : "disable"}`, {
      method: "POST",
      cache: "no-store"
    });
  } finally {
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/database");
  }
  redirect(returnTo);
}

export async function enableBridgeAction(formData: FormData) {
  await setBridgeEnabled(true, formData);
}

export async function disableBridgeAction(formData: FormData) {
  await setBridgeEnabled(false, formData);
}
