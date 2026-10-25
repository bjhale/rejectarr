export interface QueueRecord {
  id: number;
  seriesId?: number;
  episodeId?: number;
  title: string;
  size: number;
  sizeleft: number;
  timeleft?: string;
  estimatedCompletionTime?: string;
  added?: string;
  status: string;
  trackedDownloadStatus?: string;
  trackedDownloadState?: string;
  statusMessages: { title: string; messages: string[] }[];
  errorMessage?: string;
  downloadId?: string;
  protocol: string;
  downloadClient?: string;
  indexer?: string;
  outputPath?: string;
  quality: { quality: { name: string } };
  languages: { name: string }[];
  customFormats: { name: string }[];
  customFormatScore: number;
  series?: { title: string; year: number };
  episode?: { seasonNumber: number; episodeNumber: number; title: string; airDate?: string };
}

interface Page<T> {
  page: number;
  pageSize: number;
  totalRecords: number;
  records: T[];
}

export class SonarrClient {
  constructor(
    private readonly host: string,
    private readonly apiKey: string,
  ) {}

  async queue(): Promise<QueueRecord[]> {
    const records: QueueRecord[] = [];
    for (let page = 1; ; page++) {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "200",
        includeSeries: "true",
        includeEpisode: "true",
        includeUnknownSeriesItems: "true",
      });
      const res = await this.get<Page<QueueRecord>>(`/api/v3/queue?${params}`);
      records.push(...res.records);
      if (res.records.length === 0 || records.length >= res.totalRecords) return records;
    }
  }

  /**
   * Removes queue items the way the UI's "Remove from Download Client" + "Blocklist and Search" does:
   * deletes the torrent and its data from the client, blocklists the release, and searches for a replacement.
   */
  async removeAndBlocklist(queueIds: number[]): Promise<void> {
    const params = new URLSearchParams({
      removeFromClient: "true",
      blocklist: "true",
      skipRedownload: "false",
      changeCategory: "false",
    });
    const path = `/api/v3/queue/bulk?${params}`;
    const res = await fetch(`${this.host}${path}`, {
      method: "DELETE",
      headers: { "X-Api-Key": this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: queueIds }),
    });
    if (!res.ok) throw new Error(`Sonarr ${path} failed (${res.status}): ${await res.text()}`);
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.host}${path}`, { headers: { "X-Api-Key": this.apiKey } });
    if (!res.ok) throw new Error(`Sonarr ${path} failed (${res.status}): ${await res.text()}`);
    return res.json() as Promise<T>;
  }
}
