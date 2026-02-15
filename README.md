# StreamParty

Application web de streaming watch-together. Regardez des vidéos en temps réel avec vos amis, chattez, passez des appels vidéo/audio, créez des communautés — le tout dans le navigateur.

## Fonctionnalités

### 🎬 Streaming synchronisé
- **WebTorrent** — Chargez un lien magnet et streamez directement dans le navigateur
- **YouTube** — Collez un lien YouTube, file d'attente avec vote skip
- **Synchronisation temps réel** — Algorithme de correction de drift host-autoritaire (play/pause/seek synchro entre tous les participants)

### 💬 Chat & Messagerie
- **Chat en room** — Messages persistants, indicateurs de frappe, historique paginé
- **Édition & suppression** — Modifiez ou supprimez vos messages
- **Threads & réponses** — Répondez à un message pour créer un fil de discussion
- **Réactions & embeds** — Réagissez avec des emoji, preview automatique des liens
- **Messages directs** — Conversations privées entre utilisateurs
- **Mentions** — @username avec notification

### 📞 Appels vidéo/audio
- **Mesh WebRTC** — Appels via simple-peer (max 6 participants)
- **SFU mediasoup** — Appels scalables pour les grands groupes
- **Channels vocaux persistants** — Rejoignez un salon vocal à tout moment
- **Push-to-talk** — Mode talkie-walkie pour les salons vocaux

### 🏠 Rooms
- **Code à 6 caractères** — Créez une room, partagez le code, regardez ensemble
- **Partage de fichiers** — Upload et partage via WebTorrent

### 🏢 Serveurs & Communautés
- **Serveurs** — Créez des communautés avec channels texte et vocaux
- **Rôles & permissions** — Système de rôles avec permissions granulaires par channel
- **Modération** — Warn, mute, kick, ban + logs de modération
- **Auto-modération** — Filtre anti-spam, mots interdits, slowmode par channel
- **Recherche avancée** — Recherche full-text avec filtres (utilisateur, date, channel)

### 🔔 Notifications & Présence
- **Statuts utilisateur** — En ligne, Absent, Ne pas déranger, Hors ligne
- **Notifications** — Mentions, messages, appels, événements room
- **Préférences** — Configuration par type de notification
- **Activité** — "En train de regarder X", "Dans un vocal"

### 🔍 Découverte
- **Page Discover** — Explorez du contenu via un proxy d'addons

## Stack technique

| Couche | Technologies |
|--------|-------------|
| Frontend | React 19, Vite 6, Tailwind CSS, Video.js 8, Zustand |
| Backend | Node.js, Express, Socket.IO, Drizzle ORM |
| Streaming | WebTorrent (browser), simple-peer (WebRTC), mediasoup (SFU) |
| Base de données | PostgreSQL 16 |
| Temps réel | Socket.IO (sync, chat, signaling WebRTC, présence) |
| Sécurité | Helmet.js, JWT, rate limiting, validation Zod |
| WebRTC | STUN Google + TURN Xirsys |
| Tests | Vitest |

## Architecture

```
stream-party/
  client/          # React 19 + Vite + Tailwind (dark theme)
  server/          # Express + Socket.IO + Drizzle ORM
  shared/          # Types partagés, schemas Zod, constantes
```

### Modèle de synchronisation

Le host est autoritaire. Il broadcast son état toutes les 1.5 secondes. Les peers corrigent le drift :

| Drift | Action |
|-------|--------|
| < 100ms | Rien |
| 100-500ms | Ajustement vitesse (1.05x ou 0.95x) |
| > 500ms | Seek forcé |

Les events discrets (play, pause, seek) sont relayés immédiatement.

### Appels WebRTC

- **Mesh** : Topologie mesh via simple-peer pour petits groupes (max 6)
- **SFU** : mediasoup pour les groupes plus grands, avec router et transports dédiés

Le signaling (offer/answer/ICE) transite par Socket.IO.

## Démarrage rapide

### Prérequis

- Node.js 20+
- Docker (pour PostgreSQL)

### Installation

```bash
# Cloner le repo
git clone https://github.com/elie00/stream-party.git
cd stream-party

# Installer les dépendances
npm install

# Démarrer PostgreSQL
docker compose up -d

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos propres valeurs (Xirsys, JWT_SECRET, etc.)

# Pousser le schéma en base
npm run db:push -w server

# Lancer le dev server
npm run dev
```

L'application sera disponible sur `http://localhost:5173`.

## Utilisation

1. **Entrez votre nom** sur la page d'accueil
2. **Créez une room** ou **rejoignez-en une** avec un code à 6 caractères
3. **Collez un lien magnet ou YouTube** (le host uniquement) pour charger une vidéo
4. **Regardez ensemble** — play/pause/seek sont synchronisés automatiquement
5. **Chattez** via la sidebar droite
6. **Lancez un appel** vidéo/audio avec les contrôles en haut
7. **Créez un serveur** pour une communauté persistante avec channels

## Scripts

```bash
npm run dev           # Lance client + server en parallèle
npm run dev:client    # Lance uniquement le client Vite
npm run dev:server    # Lance uniquement le serveur Express

# Base de données (workspace server)
npm run db:generate -w server   # Génère les migrations Drizzle
npm run db:push -w server       # Pousse le schéma directement

# Tests
npm test -w server    # Tests serveur
npm test -w client    # Tests client
```

## Schéma de la base

| Table | Description |
|-------|------------|
| `users` | Utilisateurs (guest avec displayName) |
| `rooms` | Rooms avec code unique, magnetUri, hostId |
| `messages` | Messages de chat persistés |
| `room_participants` | Participants actifs par room |
| `servers` | Serveurs/communautés |
| `server_members` | Membres d'un serveur avec rôles |
| `channels` | Channels texte et vocaux par serveur |
| `voice_channels` | Salons vocaux persistants |
| `video_queue` | File d'attente vidéo YouTube |
| `notifications` | Notifications utilisateur |
| `notification_preferences` | Préférences de notification |
| `user_presence` | Statut de présence (online/idle/dnd/offline) |
| `moderation_logs` | Historique des actions de modération |
| `roles` | Rôles personnalisés par serveur |
| `channel_permissions` | Permissions par channel/rôle |
| `auto_mod_config` | Configuration d'auto-modération |
| `direct_message_channels` | Canaux de messages directs |
| `direct_messages` | Messages directs |
| `shared_files` | Fichiers partagés |
| `message_reactions` | Réactions aux messages |
| `message_embeds` | Embeds de liens dans les messages |
| `message_threads` | Fils de discussion |

## Structure des fichiers

```
client/src/
  pages/           # HomePage, RoomPage, ServersPage, DMPage, DiscoverPage, SettingsPage
  components/
    video/         # VideoPlayer, MagnetInput, FileSelector, TorrentStatus
    chat/          # ChatPanel, MessageList, MessageBubble, ChatInput, ThreadPanel
    call/          # CallOverlay, CallControls, VideoThumbnail
    room/          # ShareModal, ParticipantList
    server/        # ServerList, ChannelList, ServerSettings
    dm/            # DMChannelList, DMConversation
    voice/         # VoiceChannelList, VoiceControls
    moderation/    # ModerationPanel, RoleManager, PermissionEditor
    search/        # SearchBar, SearchResults, SearchFilters
    discover/      # ContentCard, MetaModal
    ui/            # Button, Input, Modal, Avatar, Toast, StatusSelector
  services/        # webtorrent, syncEngine, peerManager, sfuClient, socket, api, youtubeApi
  stores/          # authStore, roomStore, chatStore, serverStore, dmStore, notificationStore, presenceStore, moderationStore
  hooks/           # Custom hooks (useNotifications, usePresence, useResponsive, etc.)

server/src/
  db/              # Schéma Drizzle + connexion PostgreSQL
  routes/          # REST API (auth, rooms, servers, files, youtube, search, moderation, addons)
  socket/
    handlers/      # Socket.IO handlers (room, sync, chat, rtc, sfu, voice, presence, notification, server, channel, moderation, dm, youtube, reaction, embed, search)
  services/        # Business logic (chat, moderation, permissions, search, notification, presence, file storage, mediasoup, etc.)
  middleware/      # Auth JWT, rate limiting, permissions

shared/src/
  types.ts         # Types, interfaces Socket.IO, schemas Zod, constantes
```

## Licence

MIT
