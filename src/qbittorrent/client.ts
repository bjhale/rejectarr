export interface Torrent {
  hash: string;
  name: string;
  state: string;
  progress: number;
  size: number;
  ratio: number;
  category: string;
  added_on: number;
  tags: string;
  save_path: string;
  downloaded: number;
  uploaded: number;
  num_seeds: number;
  num_leechs: number;
  num_complete: number;
  num_incomplete: number;
  dlspeed: number;
  upspeed: number;
  eta: number;
  tracker: string;
  trackers_count: number;
}

export interface TorrentProperties {
  comment: string;
  created_by: string;
  creation_date: number;
  completion_date: number;
  is_private: boolean;
  pieces_have: number;
  pieces_num: number;
  piece_size: number;
  time_elapsed: number;
  seeding_time: number;
  total_wasted: number;
}

export interface TorrentFile {
  index: number;
  name: string;
  size: number;
  progress: number;
  priority: number;
}

export class QBittorrentClient {
  private cookie: string | undefined;

  constructor(
    private readonly host: string,
    private readonly username: string,
    private readonly password: string,
  ) {}

  async login(): Promise<void> {
    const res = await fetch(`${this.host}/api/v2/auth/login`, {
      method: "POST",
      headers: { Referer: this.host },
      body: new URLSearchParams({ username: this.username, password: this.password }),
    });
    const body = await res.text();
    if (!res.ok || body.trim() !== "Ok.") {
      throw new Error(`qBittorrent login failed (${res.status}): ${body.trim()}`);
    }
    // Cookie name varies by version (SID, QBT_SID_<port>), so keep the whole pair.
    this.cookie = res.headers.get("set-cookie")?.split(";")[0];
    if (!this.cookie) throw new Error("qBittorrent login returned no session cookie");
  }

  async torrents(): Promise<Torrent[]> {
    return this.get<Torrent[]>("/api/v2/torrents/info");
  }

  async properties(hash: string): Promise<TorrentProperties> {
    return this.get<TorrentProperties>(`/api/v2/torrents/properties?hash=${hash}`);
  }

  async files(hash: string): Promise<TorrentFile[]> {
    return this.get<TorrentFile[]>(`/api/v2/torrents/files?hash=${hash}`);
  }

  private async get<T>(path: string): Promise<T> {
    if (!this.cookie) await this.login();
    const res = await fetch(`${this.host}${path}`, {
      headers: { Cookie: this.cookie!, Referer: this.host },
    });
    if (!res.ok) throw new Error(`qBittorrent ${path} failed (${res.status}): ${await res.text()}`);
    return res.json() as Promise<T>;
  }
}
