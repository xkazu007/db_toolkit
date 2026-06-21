export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function statusClass(status: string) {
  return `status status-${status}`;
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "En attente",
    approved: "Approuvee",
    rejected: "Rejetee",
    failed: "Echouee",
    cancelled: "Annulee",
    all: "Toutes"
  };
  return labels[status] || status;
}
