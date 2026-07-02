from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from workflow.models import FieldMapping, TargetTable


class Command(BaseCommand):
    help = "Seed demo users and field mappings for local development."

    def handle(self, *args, **options):
        admin, _ = User.objects.update_or_create(
            username="admin",
            defaults={"is_staff": True, "is_superuser": True, "is_active": True},
        )
        admin.set_password("admin123")
        admin.save()

        agent, _ = User.objects.update_or_create(
            username="agent",
            defaults={"is_staff": False, "is_superuser": False, "is_active": True},
        )
        agent.set_password("agent123")
        agent.save()

        crcon, _ = TargetTable.objects.update_or_create(
            db_table="CRCON",
            defaults={
                "name": "CRCON",
                "key_column": "NODOSS",
                "is_active": True,
                "description": "Table contrat avec champs financiers.",
            },
        )
        crdem, _ = TargetTable.objects.update_or_create(
            db_table="ASSALAFDTA.CRDEM",
            defaults={
                "name": "CRDEM",
                "key_column": "NODOSS",
                "is_active": True,
                "description": "Table demande/export avant generation du fichier.",
            },
        )

        crcon_mappings = [
            ("Num contrat", "NODOSS", FieldMapping.DataType.TEXT, "Numero de contrat/dossier a modifier."),
            ("Code envoi", "CDENVO", FieldMapping.DataType.TEXT, "Code de destination/envoi."),
            ("Dossier de substitution 1", "NOCPA1", FieldMapping.DataType.TEXT, "Premier dossier de substitution."),
            ("Dossier de substitution 2", "NOCPA2", FieldMapping.DataType.TEXT, "Deuxieme dossier de substitution."),
            ("Dossier de substitution 3", "NOCPA3", FieldMapping.DataType.TEXT, "Troisieme dossier de substitution."),
            ("Dossier de substitution 4", "NOCPA4", FieldMapping.DataType.TEXT, "Quatrieme dossier de substitution."),
            ("Dossier de substitution 5", "NOCPA5", FieldMapping.DataType.TEXT, "Cinquieme dossier de substitution."),
            ("Code agence", "CDAGEN", FieldMapping.DataType.TEXT, "Code agence."),
            ("Nom titulaire", "NMTITU", FieldMapping.DataType.TEXT, "Nom du titulaire."),
            ("Type piece identite", "CINALP", FieldMapping.DataType.TEXT, "Type de piece d'identite."),
            ("Numero piece identite", "CINNUM", FieldMapping.DataType.TEXT, "Numero de piece d'identite."),
            ("Matricule", "CDMATR", FieldMapping.DataType.TEXT, "Matricule."),
            ("Imputation", "IMPUTA", FieldMapping.DataType.TEXT, "Code imputation."),
            ("Montant credit", "MTCRED", FieldMapping.DataType.NUMBER, "Montant du credit."),
            ("Montant total", "MNTTOT", FieldMapping.DataType.NUMBER, "Montant total."),
            ("Taux TEG", "TXTEG", FieldMapping.DataType.NUMBER, "Taux TEG."),
            ("Mensualite", "MTMENS", FieldMapping.DataType.NUMBER, "Montant de la mensualite."),
            ("Nombre de mois", "NBMOIS", FieldMapping.DataType.NUMBER, "Duree en mois."),
            ("Date echeance debut", "DTECHD", FieldMapping.DataType.DATE, "Date de debut au format DB."),
            ("Date echeance fin", "DTECHF", FieldMapping.DataType.DATE, "Date de fin au format DB."),
        ]

        crdem_mappings = [
            ("Societe", "CDSOCI", FieldMapping.DataType.TEXT, "Code societe."),
            ("Code agence", "CDAGEN", FieldMapping.DataType.TEXT, "Code agence."),
            ("Nom titulaire", "NMTITU", FieldMapping.DataType.TEXT, "Nom du titulaire."),
            ("Type piece identite", "CINALP", FieldMapping.DataType.TEXT, "Type de piece d'identite."),
            ("Numero piece identite", "CINNUM", FieldMapping.DataType.TEXT, "Numero de piece d'identite."),
            ("Matricule", "CDMATR", FieldMapping.DataType.TEXT, "Matricule."),
            ("Imputation", "IMPUTA", FieldMapping.DataType.TEXT, "Code imputation."),
            ("Code envoi", "CDENVO", FieldMapping.DataType.TEXT, "Code de destination/envoi."),
            ("Num contrat", "NODOSS", FieldMapping.DataType.TEXT, "Numero de contrat/dossier a modifier."),
            ("Dossier de substitution 1", "NOCPA1", FieldMapping.DataType.TEXT, "Premier dossier de substitution."),
            ("Dossier de substitution 2", "NOCPA2", FieldMapping.DataType.TEXT, "Deuxieme dossier de substitution."),
            ("Dossier de substitution 3", "NOCPA3", FieldMapping.DataType.TEXT, "Troisieme dossier de substitution."),
            ("Dossier de substitution 4", "NOCPA4", FieldMapping.DataType.TEXT, "Quatrieme dossier de substitution."),
            ("Dossier de substitution 5", "NOCPA5", FieldMapping.DataType.TEXT, "Cinquieme dossier de substitution."),
            ("Montant reserve", "MTRESE", FieldMapping.DataType.NUMBER, "Montant reserve."),
        ]

        for target_table, mappings in [(crcon, crcon_mappings), (crdem, crdem_mappings)]:
            active_columns = {db_column for _label, db_column, _data_type, _help_text in mappings}
            for label, db_column, data_type, help_text in mappings:
                FieldMapping.objects.update_or_create(
                    target_table=target_table,
                    db_column=db_column,
                    defaults={
                        "label": label,
                        "data_type": data_type,
                        "help_text": help_text,
                        "is_required": True,
                        "is_active": True,
                    },
                )
            FieldMapping.objects.filter(target_table=target_table).exclude(db_column__in=active_columns).update(is_active=False)

        self.stdout.write(self.style.SUCCESS("Seed complete: admin/admin123 and agent/agent123 are ready."))
