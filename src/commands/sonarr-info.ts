import { sonarrConfig } from "../config";
import { formatBytes, formatTable } from "../format";
import { resolveHash } from "../resolve";
import { SonarrClient } from "../sonarr/client";
import { episodeCode, formatEpisodes, groupQueue, sortedEpisodes } from "../sonarr/queue";

function formatDate(iso: string | undefined): string {
  return iso ? new Date(iso).toLocaleString() : "-";
}

export async function sonarrInfo(args: string[]): Promise<void> {
  const [input] = args;
  if (!input) throw new Error("Usage: rejectarr sonarr:info <hash>  (full hash or its first characters)");

  const { host, apiKey } = sonarrConfig();
  const { hash, name, records } = resolveHash(groupQueue(await new SonarrClient(host, apiKey).queue()), input, "download");
  const r = records[0]!;
  const progress = r.size > 0 ? ((r.size - r.sizeleft) / r.size) * 100 : 0;
  // Sonarr already puts the year in some titles, e.g. "Scrubs (2026)".
  const year = r.series?.year && !r.series.title.includes(`(${r.series.year})`) ? ` (${r.series.year})` : "";
  const series = r.series ? `${r.series.title}${year}` : "-";

  const fields: [string, string][] = [
    ["Title", name],
    ["Hash", hash],
    ["Series", series],
    ["Episodes", formatEpisodes(records)],
    ["Quality", r.quality.quality.name],
    ["Languages", r.languages.map((l) => l.name).join(", ") || "-"],
    ["Custom formats", `${r.customFormats.map((f) => f.name).join(", ") || "-"} (score ${r.customFormatScore})`],
    ["Status", r.status],
    ["State", r.trackedDownloadState ?? "-"],
    ["Health", r.trackedDownloadStatus ?? "-"],
    ["Progress", `${progress.toFixed(1)}% (${formatBytes(r.size - r.sizeleft)} of ${formatBytes(r.size)})`],
    ["Time left", r.timeleft ?? "-"],
    ["Added", formatDate(r.added)],
    ["Est. completion", formatDate(r.estimatedCompletionTime)],
    ["Client", `${r.downloadClient ?? "-"} (${r.protocol})`],
    ["Indexer", r.indexer ?? "-"],
    ["Output path", r.outputPath ?? "-"],
    ["Queue IDs", records.map((x) => x.id).join(", ")],
  ];
  if (r.errorMessage) fields.push(["Error", r.errorMessage]);
  const labelWidth = Math.max(...fields.map(([label]) => label.length));
  for (const [label, value] of fields) console.log(`${`${label}:`.padEnd(labelWidth + 2)}${value}`);

  const messages = r.statusMessages.flatMap((m) => m.messages.map((msg) => `  ${m.title}: ${msg}`));
  if (messages.length > 0) console.log(`\nMessages (${messages.length}):\n${messages.join("\n")}`);

  const episodes = sortedEpisodes(records);
  if (episodes.length > 0) {
    console.log(`\nEpisodes (${episodes.length}):`);
    const rows = episodes.map((e) => [episodeCode(e), e.title, e.airDate ?? "-"]);
    console.log(formatTable(["Episode", "Title", "Aired"], rows, { maxWidth: process.stdout.columns, flexColumns: [1] }));
  }
}
