# Bridge ODBC Windows

Ce petit service Python sert uniquement a parler avec IBM i Access ODBC sur Windows. L'application Next.js continue de gerer l'interface, les demandes et les validations.

## Prerequis Windows

- Python 3.11 ou plus recent
- IBM i Access ODBC Driver deja installe
- Le DSN ODBC `EVOLAN_DEV` ou une chaine ODBC complete qui marche dans SQL-View

`EVOLAN_DEV` est le DSN/alias Windows. La bibliotheque/schema SQL confirmee est `ASSALAFDTA`, donc la table cible est `ASSALAFDTA.CRDEM`.

## Installation

Depuis le dossier du projet :

```powershell
py -m venv .venv
.\.venv\Scripts\activate
pip install -r bridge\requirements.txt
```

## Configuration

Cree un fichier `.env` a la racine du projet. Le bridge Python et l'application Next.js lisent ce meme fichier.

```txt
DATABASE_URL="file:./prod.db"
APP_SESSION_SECRET="change-this-production-secret"

TARGET_DB="bridge"
BRIDGE_URL="http://127.0.0.1:8001"
TARGET_TABLE="ASSALAFDTA.CRDEM"
TARGET_KEY_COLUMN="NODOSS"

ODBC_CONNECTION_STRING="DSN=EVOLAN_DEV;UID=adm;PWD=TON_MOT_DE_PASSE"
ODBC_TARGET_TABLE="ASSALAFDTA.CRDEM"
ODBC_KEY_COLUMN="NODOSS"
ODBC_ALLOWED_COLUMNS="CDENVO,NOCPA1,NOCPA2,NOCPA3,NOCPA4,NOCPA5,CDAGEN,NMTITU,CINALP,CINNUM,CDMATR,IMPUTA,MTCRED,MNTTOT,TXTEG,MTMENS,NBMOIS,DTECHD,DTECHF"
```

Alternative sans DSN :

```txt
ODBC_CONNECTION_STRING="DRIVER={iSeries Access ODBC Driver};SYSTEM=10.7.10.79;DATABASE=ASSALAFDTA;UID=adm;PWD=TON_MOT_DE_PASSE"
```

## Lancer

```powershell
.\.venv\Scripts\activate
uvicorn bridge.main:app --host 0.0.0.0 --port 8001
```

Puis lance l'application Next.js normalement dans une autre fenetre PowerShell.
