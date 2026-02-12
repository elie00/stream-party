# Évolution StreamParty vers une Plateforme de Type Discord

## Vision

Transformer StreamParty d'une application de "watch-together" en une plateforme collaborative complète combinant:
- **Streaming vidéo** (solo et collaboratif)
- **Chat vocal** (audio persistant)
- **Partage de fichiers** (P2P)
- **Partage d'écran** (présentation)

---

## Analyse Comparative

### Positionnement Actuel vs Discord

| Fonctionnalité | StreamParty Actuel | Discord | Écart |
|----------------|-------------------|---------|-------|
| Streaming vidéo | ✅ WebTorrent | ✅ Go Live | Différent (P2P vs serveur) |
| Chat texte | ✅ Basique | ✅ Avancé | Moyen |
| Chat vocal | ⚠️ Mesh WebRTC (6 max) | ✅ SFU (illimité) | Grand |
| Partage d'écran | ❌ | ✅ | À implémenter |
| Partage de fichiers | ⚠️ Magnet uniquement | ✅ Upload direct | Moyen |
| Serveurs/Communautés | ❌ | ✅ | Grand |
| Permissions | ❌ | ✅ Granulaire | Grand |
| Bots/API | ❌ | ✅ | Grand |

### Forces Uniques de StreamParty

1. **WebTorrent natif** - Pas de serveur de streaming coûteux
2. **Synchronisation vidéo précise** - Algorithme de drift correction
3. **Anonymat** - Pas de compte requis (guest)
4. **Léger** - Pas d'Electron, 100% navigateur

---

## Architecture Proposée

### 1. Infrastructure WebRTC Évolutive

**Problème actuel**: Topologie mesh limitée à 6 participants

**Solution**: Migration vers SFU (Selective Forwarding Unit)

```
┌─────────────────────────────────────────────────────────────┐
│                        SFU Server                            │
│  (mediasoup ou LiveKit - open source, self-hosted)          │
│                                                              │
│   ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐    │
│   │ P1  │  │ P2  │  │ P3  │  │ P4  │  │ P5  │  │ P6  │    │
│   └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘    │
│      │        │        │        │        │        │         │
│   ┌──▼────────▼────────▼────────▼────────▼────────▼──┐     │
│   │              Router (SFU)                         │     │
│   │  - Forward streams to all participants            │     │
│   │  - Handle simulcast (quality layers)              │     │
│   │  - Support 100+ participants per room             │     │
│   └───────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Options techniques**:
- **mediasoup** (Node.js) - Excellent pour l'intégration avec Express
- **LiveKit** (Go) - Plus de fonctionnalités, meilleure scalabilité
- **Janus** (C) - Très performant, plus complexe

### 2. Nouveaux Modules

#### A. Partage d'Écran

```typescript
// client/src/services/screenShare.ts
export class ScreenShareService {
  async startSharing(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' },
      audio: true, // Include system audio
    });
    
    // Publish to SFU
    await this.sfu.publishTrack(stream.getVideoTracks()[0], {
      source: 'screen',
      simulcast: false, // Screen share doesn't need simulcast
    });
    
    return stream;
  }
}
```

#### B. Chat Vocal Persistant

```typescript
// server/src/services/voiceChannel.ts
interface VoiceChannel {
  id: string;
  roomId: string;
  type: 'temporary' | 'persistent';
  participants: Map<string, VoiceParticipant>;
  bitrate: number;
}

// Unlike current call system, voice channels:
// - Persist even when empty
// - Support push-to-talk
// - Have audio processing (noise suppression, AGC)
// - Support deafen/mute states
```

#### C. Partage de Fichiers

```typescript
// client/src/services/fileShare.ts
export class FileShareService {
  // Option 1: WebTorrent for large files (P2P)
  async shareViaTorrent(file: File): Promise<string> {
    const torrent = await this.client.seed(file);
    return torrent.magnetURI;
  }
  
  // Option 2: Direct upload for small files
  async uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/files', {
      method: 'POST',
      body: formData,
    });
    return response.json().url;
  }
}
```

### 3. Modèle de Données Étendu

```typescript
// shared/src/types-extended.ts

// Nouveau: Serveurs/Communautés
interface Server {
  id: string;
  name: string;
  icon: string;
  ownerId: string;
  channels: Channel[];
  roles: Role[];
  members: ServerMember[];
}

interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: 'text' | 'voice' | 'video';
  position: number;
  permissions: PermissionOverwrite[];
}

interface Role {
  id: string;
  name: string;
  color: string;
  permissions: Permission[];
  position: number;
}

// Nouveau: Messages enrichis
interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  embeds: Embed[];
  attachments: Attachment[];
  reactions: Reaction[];
  replyTo?: string;
  createdAt: Date;
  updatedAt?: Date;
}

interface Attachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  type: 'image' | 'video' | 'audio' | 'file';
}
```

---

## Roadmap d'Implémentation

### Phase 1: Fondations (2-3 semaines)

1. **Migration SFU**
   - Intégrer mediasoup ou LiveKit
   - Remplacer simple-peer par le client SFU
   - Supporter 50+ participants

2. **Partage d'écran**
   - Implémenter `getDisplayMedia`
   - Ajouter indicateur "partage en cours"
   - Gérer l'arrêt automatique

### Phase 2: Communication (2-3 semaines)

3. **Chat vocal persistant**
   - Canaux vocaux dédiés
   - Push-to-talk
   - Indicateurs de présence vocale

4. **Messages enrichis**
   - Embeds (liens, images)
   - Réactions emoji
   - Réponses/threads

### Phase 3: Organisation (3-4 semaines)

5. **Système de serveurs**
   - Créer/gérer des serveurs
   - Canaux multiples
   - Invitations

6. **Permissions**
   - Rôles personnalisables
   - Permissions granulaires
   - Modération basique

### Phase 4: Fichiers (1-2 semaines)

7. **Partage de fichiers**
   - Upload direct (petits fichiers)
   - WebTorrent (gros fichiers)
   - Prévisualisation

---

## Défis Techniques

### 1. Scalabilité SFU

**Problème**: Un SFU unique devient un goulot d'étranglement

**Solutions**:
- **SFU distribué** avec Redis pour la signalisation
- **MCU** (Multipoint Control Unit) pour très grandes salles
- **Edge nodes** géodistribués

### 2. Coûts d'Infrastructure

| Composant | Coût estimé (100 users simultanés) |
|-----------|-----------------------------------|
| SFU (mediasoup) | 1 VPS 4 CPU, 8GB RAM (~$40/mois) |
| Signalisation (Socket.IO) | Inclus dans le VPS |
| Stockage fichiers | S3-compatible (~$10/mois) |
| TURN servers | Xirsys ou self-hosted (~$20/mois) |

**Total**: ~$70/mois pour 100 utilisateurs simultanés

### 3. Sécurité

- **Chiffrement E2E** pour les appels (WebRTC est déjà chiffré)
- **Validation stricte** des fichiers uploadés
- **Rate limiting** avancé
- **Moderation tools** (mute, kick, ban)

---

## Différenciation vs Discord

### Positionnement Unique

1. **Streaming P2P** - Pas de limite de qualité, pas de coûts CDN
2. **Watch parties natives** - Synchronisation vidéo intégrée
3. **Open source** - Self-hostable, transparent
4. **Privacy-first** - Pas de tracking, données minimales
5. **No vendor lock-in** - Standards ouverts (WebRTC, WebTorrent)

### Cible

- **Communautés de streaming** (films, séries, anime)
- **Équipes distantes** (watch parties d'entreprise)
- **Groupes privés** (famille, amis)
- **Événements virtuels** (festivals, conventions)

---

## Fonctionnalité: Support YouTube

### Analyse Technique

L'ajout du support YouTube est une fonctionnalité très demandée pour les watch parties. Voici les options:

#### Option 1: YouTube IFrame API (Recommandée)

```typescript
// client/src/services/youtubePlayer.ts
export class YouTubePlayerService {
  private player: YT.Player | null = null;
  
  async loadVideo(videoId: string, elementId: string): Promise<void> {
    return new Promise((resolve) => {
      this.player = new YT.Player(elementId, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
        },
        events: {
          onReady: () => resolve(),
          onStateChange: this.handleStateChange,
        },
      });
    });
  }
  
  // Synchronisation
  getCurrentTime(): number {
    return this.player?.getCurrentTime() ?? 0;
  }
  
  seekTo(seconds: number): void {
    this.player?.seekTo(seconds, true);
  }
  
  play(): void {
    this.player?.playVideo();
  }
  
  pause(): void {
    this.player?.pauseVideo();
  }
}
```

**Avantages**:
- Officiel et légal
- Qualité jusqu'à 4K
- Gestion automatique des publicités

**Inconvénients**:
- Pas de contrôle total sur l'UI
- Restrictions CORS pour certains contenus
- Nécessite une clé API YouTube

#### Option 2: youtube-dl / yt-dlp (Backend)

```typescript
// server/src/services/youtubeProxy.ts
import { exec } from 'child_process';

export async function getYouTubeStreamUrl(videoUrl: string): Promise<string> {
  const { stdout } = await exec(`yt-dlp -g -f best "${videoUrl}"`);
  return stdout.trim();
}
```

**Avantages**:
- Contournement des restrictions
- Accès aux flux directs

**Inconvénients**:
- Consommation serveur
- Questions légales (TOS YouTube)
- Maintenance continue

### Architecture Proposée

```
┌─────────────────────────────────────────────────────────────┐
│                      VideoPlayer                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 Unified Player                        │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐ │   │
│  │  │ Video.js  │  │ YouTube   │  │ WebTorrent        │ │   │
│  │  │ (local)   │  │ IFrame    │  │ (magnet)          │ │   │
│  │  └───────────┘  └───────────┘  └───────────────────┘ │   │
│  │                                                      │   │
│  │              Common Sync Interface                   │   │
│  │  - play() / pause() / seek(time)                     │   │
│  │  - getCurrentTime() / isPlaying()                    │   │
│  │  - onStateChange(callback)                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Implémentation

#### 1. Type de Source Unifié

```typescript
// shared/src/types.ts
type VideoSource = 
  | { type: 'magnet'; uri: string; fileIndex?: number }
  | { type: 'youtube'; videoId: string }
  | { type: 'url'; url: string };

// Mise à jour des événements Socket
interface RoomState {
  // ... existing fields
  videoSource: VideoSource | null;
}
```

#### 2. Composant Player Unifié

```tsx
// client/src/components/video/UnifiedVideoPlayer.tsx
interface UnifiedPlayerProps {
  source: VideoSource;
  onReady: (player: PlayerInterface) => void;
  onPlay: () => void;
  onPause: () => void;
  onSeeked: (time: number) => void;
}

export function UnifiedVideoPlayer({ source, ...props }: UnifiedPlayerProps) {
  switch (source.type) {
    case 'youtube':
      return <YouTubePlayer videoId={source.videoId} {...props} />;
    case 'magnet':
      return <TorrentPlayer magnetUri={source.uri} {...props} />;
    case 'url':
      return <VideoPlayer src={source.url} {...props} />;
  }
}
```

#### 3. Input Unifié

```tsx
// client/src/components/video/VideoInput.tsx
export function VideoInput({ onSubmit }: { onSubmit: (source: VideoSource) => void }) {
  const [input, setInput] = useState('');
  
  const handleSubmit = () => {
    const source = parseVideoInput(input);
    if (source) {
      onSubmit(source);
    }
  };
  
  return (
    <div className="flex gap-2">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste YouTube link, magnet link, or video URL..."
      />
      <Button onClick={handleSubmit}>Load</Button>
    </div>
  );
}

function parseVideoInput(input: string): VideoSource | null {
  // YouTube
  const ytMatch = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return { type: 'youtube', videoId: ytMatch[1] };
  }
  
  // Magnet
  if (input.startsWith('magnet:')) {
    return { type: 'magnet', uri: input };
  }
  
  // Direct URL
  if (input.startsWith('http') && /\.(mp4|webm|mkv|avi)/i.test(input)) {
    return { type: 'url', url: input };
  }
  
  return null;
}
```

### Synchronisation YouTube

Le défi principal est que l'API YouTube IFrame a des limitations de synchronisation:

```typescript
// Solution: Polling + Event-based sync
class YouTubeSyncAdapter {
  private lastKnownTime = 0;
  private pollInterval: NodeJS.Timeout | null = null;
  
  startSync() {
    // Poll current time every 500ms
    this.pollInterval = setInterval(() => {
      const currentTime = this.player.getCurrentTime();
      if (Math.abs(currentTime - this.lastKnownTime) > 0.5) {
        this.onTimeUpdate?.(currentTime);
      }
      this.lastKnownTime = currentTime;
    }, 500);
  }
  
  // YouTube API events
  handleStateChange(event: YT.OnStateChangeEvent) {
    switch (event.data) {
      case YT.PlayerState.PLAYING:
        this.onPlay?.();
        break;
      case YT.PlayerState.PAUSED:
        this.onPause?.();
        break;
    }
  }
}
```

### Considérations Légales

⚠️ **Important**: L'utilisation de YouTube IFrame API est soumise aux Conditions d'Utilisation de YouTube:
- Pas de contournement des publicités
- Attribution requise
- Pas de téléchargement

Pour une utilisation commerciale, considérer:
- YouTube Data API (quota gratuit: 10,000 unités/jour)
- Négocier un partenariat YouTube

---

## Conclusion

Transformer StreamParty en concurrent de Discord est **ambitieux mais réalisable**. L'architecture actuelle est solide et les technologies (WebRTC, WebTorrent) sont adaptées.

**Recommandation**: Commencer par la **Phase 1** (SFU + partage d'écran) qui apporte une valeur immédiate sans changer radicalement le produit. Ensuite, itérer selon les retours utilisateurs.

**Investissement estimé**: 8-12 semaines de développement pour un MVP compétitif.

Voulez-vous que je commence l'implémentation de la Phase 1 (migration SFU + partage d'écran) ?
