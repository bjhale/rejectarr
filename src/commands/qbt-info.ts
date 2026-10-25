import { qbittorrentConfig } from "../config";
import { formatBytes, formatTable } from "../format";
import { QBittorrentClient } from "../qbittorrent/client";
import { resolveHash } from "../resolve";

// qBittorrent reports "never" as 0 or -1 for dates and 8640000 (100 days) for ETA.
const INFINITE_ETA = 8640000;

function formatDate(seconds: number): string {
  if (seconds <= 0) return "-";
  return new Date(seconds * 1000).toLocaleString();
}

function formatDuration(seconds: number): string {
  if (seconds < 0 || seconds >= INFINITE_ETA) return "∞";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}

export async function qbtInfo(args: string[]): Promise<void> {
  const [input] = args;
  if (!input) throw new Error("Usage: rejectarr qbt:info <hash>  (full hash or its first characters)");

  const { host, username, password } = qbittorrentConfig();
  const client = new QBittorrentClient(host, username, password);
  const t = resolveHash(await client.torrents(), input);
  const [props, files] = await Promise.all([client.properties(t.hash), client.files(t.hash)]);

  const fields: [string, string][] = [
    ["Name", t.name],
    ["Hash", t.hash],
    ["State", t.state],
    ["Progress", `${(t.progress * 100).toFixed(1)}% (${props.pieces_have}/${props.pieces_num} pieces)`],
    ["Size", formatBytes(t.size)],
    ["Downloaded", formatBytes(t.downloaded)],
    ["Uploaded", formatBytes(t.uploaded)],
    ["Ratio", t.ratio.toFixed(2)],
    ["Speed", `↓ ${formatBytes(t.dlspeed)}/s  ↑ ${formatBytes(t.upspeed)}/s`],
    ["ETA", formatDuration(t.eta)],
    ["Seeds", `${t.num_seeds} connected (${t.num_complete} in swarm)`],
    ["Peers", `${t.num_leechs} connected (${t.num_incomplete} in swarm)`],
    ["Category", t.category || "-"],
    ["Tags", t.tags || "-"],
    ["Save path", t.save_path],
    ["Added", formatDate(t.added_on)],
    ["Completed", formatDate(props.completion_date)],
    ["Active for", formatDuration(props.time_elapsed)],
    ["Private", props.is_private ? "yes" : "no"],
    ["Trackers", `${t.trackers_count} (current: ${t.tracker || "none"})`],
    ["Comment", props.comment || "-"],
  ];
  const labelWidth = Math.max(...fields.map(([label]) => label.length));
  for (const [label, value] of fields) console.log(`${`${label}:`.padEnd(labelWidth + 2)}${value}`);

  console.log(`\nFiles (${files.length}):`);
  const rows = files.map((f) => [f.name, formatBytes(f.size), `${(f.progress * 100).toFixed(1)}%`]);
  console.log(formatTable(["Name", "Size", "Progress"], rows, { maxWidth: process.stdout.columns, flexColumns: [0] }));
}
