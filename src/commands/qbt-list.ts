import { qbittorrentConfig } from "../config";
import { formatBytes, formatTable } from "../format";
import { QBittorrentClient } from "../qbittorrent/client";

export async function qbtList(): Promise<void> {
  const { host, username, password } = qbittorrentConfig();
  const client = new QBittorrentClient(host, username, password);
  const torrents = await client.torrents();

  if (torrents.length === 0) {
    console.log("No torrents.");
    return;
  }

  torrents.sort((a, b) => a.added_on - b.added_on);
  const rows = torrents.map((t) => [
    t.hash.slice(0, 8),
    t.name,
    t.state,
    `${(t.progress * 100).toFixed(1)}%`,
    formatBytes(t.size),
    t.ratio.toFixed(2),
    t.category,
  ]);
  const headers = ["Hash", "Name", "State", "Progress", "Size", "Ratio", "Category"];
  console.log(formatTable(headers, rows, { maxWidth: process.stdout.columns, flexColumns: [1] }));
  console.log(`\n${torrents.length} torrent(s)`);
}
