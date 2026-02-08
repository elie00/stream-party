import WebTorrent from 'webtorrent';

export interface TorrentFileInfo {
  name: string;
  length: number;
  index: number;
}

export interface TorrentStats {
  downloadSpeed: number;
  uploadSpeed: number;
  progress: number;
  numPeers: number;
  downloaded: number;
  total: number;
}

class WebTorrentService {
  private client: WebTorrent.Instance | null = null;
  private currentTorrent: WebTorrent.Torrent | null = null;

  async init(): Promise<void> {
    if (this.client) return;
    this.client = new WebTorrent();
  }

  async addTorrent(magnetUri: string): Promise<WebTorrent.Torrent> {
    if (!this.client) await this.init();

    // Remove existing torrent if any
    if (this.currentTorrent) {
      this.removeTorrent();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Torrent connection timed out after 30 seconds'));
      }, 30000);

      this.client!.add(magnetUri, (torrent) => {
        clearTimeout(timeout);
        this.currentTorrent = torrent;
        resolve(torrent);
      });
    });
  }

  async getStreamUrl(fileIndex: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.currentTorrent) {
        reject(new Error('No torrent loaded'));
        return;
      }

      const file = this.currentTorrent.files[fileIndex];
      if (!file) {
        reject(new Error('File not found at index ' + fileIndex));
        return;
      }

      // Try streamURL first (service worker mode)
      const fileAny = file as any;
      if (fileAny.streamURL) {
        resolve(fileAny.streamURL as string);
        return;
      }

      // Fallback to blob URL
      (file as any).getBlobURL((err: Error | null, url?: string) => {
        if (err) reject(err);
        else if (url) resolve(url);
        else reject(new Error('Failed to get blob URL'));
      });
    });
  }

  getCurrentTorrent(): WebTorrent.Torrent | null {
    return this.currentTorrent;
  }

  getFiles(): TorrentFileInfo[] {
    if (!this.currentTorrent) return [];
    return this.currentTorrent.files.map((f, i) => ({
      name: f.name,
      length: f.length,
      index: i,
    }));
  }

  getVideoFiles(): TorrentFileInfo[] {
    const videoExts = ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v'];
    return this.getFiles().filter((f) =>
      videoExts.some((ext) => f.name.toLowerCase().endsWith(ext)),
    );
  }

  removeTorrent(): void {
    if (this.currentTorrent && this.client) {
      const infoHash = this.currentTorrent.infoHash;
      try {
        // Check if torrent still exists before trying to remove
        if (this.client.get(infoHash)) {
          this.client.remove(this.currentTorrent);
        }
      } catch (err) {
        // Log warning but don't crash - torrent may have been removed elsewhere
        console.warn('Failed to remove torrent:', err);
      }
      this.currentTorrent = null;
    }
  }

  destroy(): void {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.currentTorrent = null;
    }
  }

  getStats(): TorrentStats | null {
    if (!this.currentTorrent) return null;
    return {
      downloadSpeed: this.currentTorrent.downloadSpeed,
      uploadSpeed: this.currentTorrent.uploadSpeed,
      progress: this.currentTorrent.progress,
      numPeers: this.currentTorrent.numPeers,
      downloaded: this.currentTorrent.downloaded,
      total: this.currentTorrent.length,
    };
  }
}

export const webtorrentService = new WebTorrentService();
