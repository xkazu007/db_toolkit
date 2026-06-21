import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Demandes de modification",
  description: "Workflow local de demandes de modification"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
