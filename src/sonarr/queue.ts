import type { QueueRecord } from "./client";

/** One download in the Sonarr queue; season packs have a record per episode. */
export interface QueueDownload {
  /** Lowercase torrent hash, matching qBittorrent. */
  hash: string;
  name: string;
  records: QueueRecord[];
}

export function groupQueue(records: QueueRecord[]): QueueDownload[] {
  const downloads = new Map<string, QueueDownload>();
  for (const record of records) {
    // Items without a download ID can't be matched to a torrent; key them by queue ID.
    const hash = record.downloadId?.toLowerCase() ?? `queue-${record.id}`;
    const download = downloads.get(hash) ?? { hash, name: record.title, records: [] };
    download.records.push(record);
    downloads.set(hash, download);
  }
  return [...downloads.values()];
}

type Episode = NonNullable<QueueRecord["episode"]>;

/** Every status and error message Sonarr reports for a download. */
export function queueMessages(download: QueueDownload): string[] {
  return download.records.flatMap((r) => [
    ...r.statusMessages.flatMap((m) => m.messages),
    ...(r.errorMessage ? [r.errorMessage] : []),
  ]);
}

const pad =(n: number) => String(n).padStart(2, "0");

export function episodeCode(e: Episode): string {
  return `S${pad(e.seasonNumber)}E${pad(e.episodeNumber)}`;
}

/** The download's episodes, in season/episode order. */
export function sortedEpisodes(records: QueueRecord[]): Episode[] {
  return records
    .flatMap((r) => (r.episode ? [r.episode] : []))
    .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
}

export function formatEpisodes(records: QueueRecord[]): string {
  const episodes = sortedEpisodes(records);
  if (episodes.length === 0) return "-";

  const first = episodes[0]!;
  const last = episodes[episodes.length - 1]!;
  const contiguous =
    first.seasonNumber === last.seasonNumber && last.episodeNumber - first.episodeNumber === episodes.length - 1;
  if (episodes.length === 1) return episodeCode(first);
  if (contiguous) return `${episodeCode(first)}-E${pad(last.episodeNumber)}`;
  return episodes.map(episodeCode).join(",");
}
