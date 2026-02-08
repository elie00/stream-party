# StreamParty

Application web de streaming watch-together. Collez un lien magnet, regardez en temps reel avec vos amis, chattez et passez des appels video/audio - le tout dans le navigateur.

## Fonctionnalites

- **Streaming WebTorrent** - Chargez un lien magnet et streamez directement dans le navigateur via WebTorrent
- **Synchronisation temps reel** - Algorithme de correction de drift host-autoritaire (play/pause/seek synchro entre tous les participants)
- **Chat** - Messages persistants en base, indicateurs de frappe, historique avec pagination
- **Appels video/audio** - Mesh WebRTC via simple-peer (max 6 participants), signaling via Socket.IO
- **Rooms** - Creez une room, partagez le code a 6 caracteres, regardez ensemble

## Stack technique

| Couche | Technologies |
|--------|-------------|
| Frontend | React 19, Vite, Tailwind CSS, Video.js 8, Zustand |
| Backend | Node.js, Express, Socket.IO, Drizzle ORM |
| Streaming | WebTorrent (browser), simple-peer (WebRTC) |
| Base de donnees | PostgreSQL 16 |
| Temps reel | Socket.IO (sync, chat, signaling WebRTC) |

## Architecture

```
stream-party/
  client/          # React 19 + Vite + Tailwind (dark theme)
  server/          # Express + Socket.IO + Drizzle ORM
  shared/          # Types partages, schemas Zod, constantes
```

### Modele de synchronisation

Le host est autoritaire. Il broadcast son etat toutes les 1.5 secondes. Les peers corrigent le drift :

| Drift | Action |
|-------|--------|
| < 100ms | Rien |
| 100-500ms | Ajustement vitesse (1.05x ou 0.95x) |
| > 500ms | Seek force |

Les events discrets (play, pause, seek) sont relayes immediatement.

### Appels WebRTC

Topologie mesh via simple-peer. Le signaling (offer/answer/ICE) transite par Socket.IO. Configuration STUN Google pour le developpement, TURN (coturn) recommande pour la production.

## Demarrage rapide

### Prerequis

- Node.js 20+
- Docker (pour PostgreSQL)

### Installation

```bash
# Cloner le repo
git clone https://github.com/eyalb181/stream-party.git
cd stream-party

# Installer les dependances
npm install

# Demarrer PostgreSQL
docker compose up -d

# Configurer l'environnement
cp server/.env.example server/.env

# Pousser le schema en base
npm run db:push -w server

# Lancer le dev server
npm run dev
```

L'application sera disponible sur `http://localhost:5173`.

## Utilisation

1. **Entrez votre nom** sur la page d'accueil
2. **Creez une room** ou **rejoignez-en une** avec un code a 6 caracteres
3. **Collez un lien magnet** (le host uniquement) pour charger une video
4. **Regardez ensemble** - play/pause/seek sont synchronises automatiquement
5. **Chattez** via la sidebar droite
6. **Lancez un appel** video/audio avec les controles en haut

## Scripts

```bash
npm run dev           # Lance client + server en parallele
npm run dev:client    # Lance uniquement le client Vite
npm run dev:server    # Lance uniquement le serveur Express

# Base de donnees (workspace server)
npm run db:generate -w server   # Genere les migrations Drizzle
npm run db:push -w server       # Pousse le schema directement
```

## Schema de la base

| Table | Description |
|-------|------------|
| `users` | Utilisateurs (guest avec displayName) |
| `rooms` | Rooms avec code unique, magnetUri, hostId |
| `messages` | Messages de chat persistes |
| `room_participants` | Participants actifs par room |

## Structure des fichiers

```
client/src/
  pages/           # HomePage, RoomPage, NotFoundPage
  components/
    video/         # VideoPlayer, MagnetInput, FileSelector, TorrentStatus
    chat/          # ChatPanel, MessageList, MessageBubble, ChatInput
    call/          # CallOverlay, CallControls, VideoThumbnail
    room/          # ShareModal, ParticipantList
    ui/            # Button, Input, Modal, Avatar, Toast
  services/        # webtorrent, syncEngine, peerManager, socket, api
  stores/          # authStore, roomStore, chatStore

server/src/
  db/              # Schema Drizzle + connexion
  routes/          # REST API (auth, rooms)
  socket/          # Socket.IO handlers (room, sync, chat, rtc)
  middleware/      # Auth JWT

shared/src/
  types.ts         # Types, interfaces Socket.IO, schemas Zod, constantes
```

## Licence

MIT
