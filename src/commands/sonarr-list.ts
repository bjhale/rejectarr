import { sonarrConfig } from "../config";
import { formatBytes, formatTable } from "../format";
import { SonarrClient } from "../sonarr/client";
import { formatEpisodes, groupQueue } from "../sonarr/queue";

export async function sonarrList(): Promise<void> {
  const { host, apiKey } = sonarrConfig();
  const downloads = groupQueue(await new SonarrClient(host, apiKey).queue());

  if (downloads.length === 0) {
    console.log("Sonarr queue is empty.");
    return;
  }

  downloads.sort((a, b) => (a.records[0]!.added ?? "").localeCompare(b.records[0]!.added ?? ""));
  const rows = downloads.map(({ hash, name, records }) => {
    const r = records[0]!;
    const progress = r.size > 0 ? ((r.size - r.sizeleft) / r.size) * 100 : 0;
    return [
      hash.slice(0, 8),
      name,
      r.series?.title ?? "-",
      formatEpisodes(records),
      r.trackedDownloadState ?? r.status,
      r.trackedDownloadStatus ?? "-",
      `${progress.toFixed(1)}%`,
      formatBytes(r.size),
    ];
  });
  const headers = ["Hash", "Title", "Series", "Episodes", "State", "Health", "Progress", "Size"];
  console.log(formatTable(headers, rows, { maxWidth: process.stdout.columns, flexColumns: [1] }));
  console.log(`\n${downloads.length} download(s)`);
}
