# Application de demandes de modification

Petite application locale pour remplacer les demandes de modification envoyees par email.

## Comptes

L'authentification est volontairement simple et codee en dur :

- `admin` / `admin123`
- `agent` / `agent123`

La page Utilisateurs garde des fiches locales pour l'administration, mais seuls ces deux comptes peuvent se connecter dans ce MVP.

## Installation

```bash
cp .env.example .env
npm install
npm run db:push
npm run db:seed
npm run dev
```

Ouvrir `http://localhost:3000`. Si le port est deja utilise, Next.js affiche un autre port, par exemple `http://localhost:3002`.

## Base cible locale avec Postgres

Pour tester sans DB2, l'application peut mettre a jour une table Postgres locale.

Dans `.env` :

```txt
TARGET_DB=postgres
TARGET_DATABASE_URL=postgresql://zakaria@localhost:5432/db_toolkit
TARGET_TABLE=CRCON
TARGET_KEY_COLUMN=NODOSS
```

Creer la base si elle n'existe pas :

```bash
createdb db_toolkit
```

Creer et remplir la table `CRCON` :

```bash
npm run pg:init
```

Verifier la connexion et lire une ligne :

```bash
npm run pg:check
```

Pour tester un autre `NODOSS` :

```bash
npm run pg:check -- V848491
```

## Basculer vers DB2

Pour utiliser DB2 au lieu de Postgres, modifier `.env` :

```txt
TARGET_DB=db2
DB2_CONNECTION_STRING=DATABASE=testdb;HOSTNAME=localhost;UID=db2inst1;PWD=password;PORT=50000;PROTOCOL=TCPIP
DB2_TARGET_TABLE=CRCON
DB2_CONTRACT_COLUMN=NODOSS
```

Puis verifier :

```bash
npm run db2:check
```

## Basculer vers IBM i Access ODBC sur Windows

Le serveur IBM i fonctionne deja via SQL-View avec le driver Windows `IBM i Access ODBC Driver`. Le chemin le plus simple est donc :

- garder cette application Next.js pour l'interface
- lancer le bridge Python sur Windows, la ou le DSN `EVOLAN_DEV` existe
- configurer Next.js avec `TARGET_DB=bridge`

Installer le bridge :

```powershell
py -m venv .venv
.\.venv\Scripts\activate
pip install -r bridge\requirements.txt
```

Lancer le bridge :

```powershell
$env:ODBC_CONNECTION_STRING="DSN=EVOLAN_DEV;UID=adm;PWD=TON_MOT_DE_PASSE"
$env:ODBC_TARGET_TABLE="ASSALAFDTA.CRDEM"
$env:ODBC_KEY_COLUMN="NODOSS"
uvicorn bridge.main:app --host 0.0.0.0 --port 8001
```

Dans `.env` cote application :

```txt
TARGET_DB=bridge
BRIDGE_URL=http://127.0.0.1:8001
TARGET_TABLE=ASSALAFDTA.CRDEM
TARGET_KEY_COLUMN=NODOSS
```

Tester le bridge :

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
Invoke-RestMethod "http://127.0.0.1:8001/rows?limit=5"
```

Tester depuis l'application en PowerShell :

```powershell
$env:TARGET_DB="bridge"
$env:BRIDGE_URL="http://127.0.0.1:8001"
npm run target:check
```

Ne mets jamais le vrai mot de passe dans Git. Utilise `.env` localement ou les variables PowerShell sur le serveur.

## Tester DB2 avec Docker

Sur une machine qui a Docker, tu peux tester la connexion DB2 sans installer Node/npm sur l'hote.

Construire l'image de test :

```bash
docker build --target db-check -t contract-db-check .
```

Tester DB2 :

```bash
docker run --rm \
  -e TARGET_DB=db2 \
  -e DB2_CONNECTION_STRING="DATABASE=REAL_DB;HOSTNAME=db-server.company.local;UID=USER;PWD=PASSWORD;PORT=50000;PROTOCOL=TCPIP" \
  -e DB2_TARGET_TABLE=CRCON \
  -e DB2_CONTRACT_COLUMN=NODOSS \
  -e SAMPLE_NODOSS=1045810 \
  contract-db-check
```

Important : dans Docker, `localhost` pointe vers le conteneur, pas vers la machine DB2. Comme ta DB est sur une autre machine, utilise le hostname ou l'adresse IP du serveur DB2 dans `HOSTNAME=...`.

Si ton organisation bloque le reseau, il faut verifier :

- le serveur Docker peut joindre le serveur DB2 sur le port `50000`
- le firewall du serveur DB2 autorise cette machine
- le hostname DB2 est resolvable depuis le conteneur, sinon utilise l'IP

Pour tester rapidement le port depuis la machine Docker :

```bash
nc -vz db-server.company.local 50000
```

## DB2 local via Docker

Demarrer DB2 :

```bash
docker compose up -d db2
```

Sur Mac Apple Silicon, l'image DB2 tourne en emulation `linux/amd64`. Le premier demarrage peut etre lent.

Apres le demarrage complet de DB2, creer la table locale `CRCON` :

```bash
docker exec -i db_toolkit-db2-1 su - db2inst1 -c "db2 connect to testdb && db2 -tv" < db2/init.sql
```

Configuration DB2 :

```txt
DB2_TARGET_TABLE=CRCON
DB2_CONTRACT_COLUMN=NODOSS
```

Lignes de test incluses :

```txt
NODOSS=1045810
CDENVO=5
NOCPA1=
```

## Parcours de test

1. Se connecter avec `agent`.
2. Creer une demande pour le `NODOSS` `1045810`.
3. Choisir un ou plusieurs champs, par exemple `Code envoi`.
4. Se deconnecter et se connecter avec `admin`.
5. Ouvrir le detail de la demande.
6. Verifier le SQL genere.
7. Approuver.

Si la base cible n'est pas joignable, si la connexion est mauvaise, ou si le `NODOSS` ne correspond a aucune ligne, la demande passe en statut `Echouee` avec une raison d'echec.
