import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { username: "admin" },
    update: { role: "admin", isActive: true, passwordNote: "Mot de passe code en dur : admin123" },
    create: { username: "admin", role: "admin", isActive: true, passwordNote: "Mot de passe code en dur : admin123" }
  });

  await prisma.user.upsert({
    where: { username: "agent" },
    update: { role: "agent", isActive: true, passwordNote: "Mot de passe code en dur : agent123" },
    create: { username: "agent", role: "agent", isActive: true, passwordNote: "Mot de passe code en dur : agent123" }
  });

  const mappings = [
    { label: "Code envoi", dbColumn: "CDENVO", dataType: "text", helpText: "Code de destination/envoi." },
    { label: "Dossier de substitution 1", dbColumn: "NOCPA1", dataType: "text", helpText: "Premier dossier de substitution." },
    { label: "Dossier de substitution 2", dbColumn: "NOCPA2", dataType: "text", helpText: "Deuxieme dossier de substitution." },
    { label: "Dossier de substitution 3", dbColumn: "NOCPA3", dataType: "text", helpText: "Troisieme dossier de substitution." },
    { label: "Dossier de substitution 4", dbColumn: "NOCPA4", dataType: "text", helpText: "Quatrieme dossier de substitution." },
    { label: "Dossier de substitution 5", dbColumn: "NOCPA5", dataType: "text", helpText: "Cinquieme dossier de substitution." },
    { label: "Code agence", dbColumn: "CDAGEN", dataType: "text", helpText: "Code agence." },
    { label: "Nom titulaire", dbColumn: "NMTITU", dataType: "text", helpText: "Nom du titulaire." },
    { label: "Type piece identite", dbColumn: "CINALP", dataType: "text", helpText: "Type de piece d'identite." },
    { label: "Numero piece identite", dbColumn: "CINNUM", dataType: "text", helpText: "Numero de piece d'identite." },
    { label: "Matricule", dbColumn: "CDMATR", dataType: "text", helpText: "Matricule." },
    { label: "Imputation", dbColumn: "IMPUTA", dataType: "text", helpText: "Code imputation." },
    { label: "Montant credit", dbColumn: "MTCRED", dataType: "number", helpText: "Montant du credit." },
    { label: "Montant total", dbColumn: "MNTTOT", dataType: "number", helpText: "Montant total." },
    { label: "Taux TEG", dbColumn: "TXTEG", dataType: "number", helpText: "Taux TEG." },
    { label: "Mensualite", dbColumn: "MTMENS", dataType: "number", helpText: "Montant de la mensualite." },
    { label: "Nombre de mois", dbColumn: "NBMOIS", dataType: "number", helpText: "Duree en mois." },
    { label: "Date echeance debut", dbColumn: "DTECHD", dataType: "date", helpText: "Date de debut au format DB." },
    { label: "Date echeance fin", dbColumn: "DTECHF", dataType: "date", helpText: "Date de fin au format DB." }
  ];

  for (const mapping of mappings) {
    const existing = await prisma.fieldMapping.findFirst({ where: { dbColumn: mapping.dbColumn } });
    if (existing) {
      await prisma.fieldMapping.update({ where: { id: existing.id }, data: { ...mapping, isRequired: true, isActive: true } });
    } else {
      await prisma.fieldMapping.create({ data: { ...mapping, isRequired: true, isActive: true } });
    }
  }

  await prisma.fieldMapping.updateMany({
    where: { dbColumn: "NODOSS" },
    data: {
      label: "Numero de dossier",
      isActive: false,
      adminNote: "Champ identifiant utilise pour trouver la ligne CRCON. Il ne doit pas etre modifiable par les agents."
    }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
