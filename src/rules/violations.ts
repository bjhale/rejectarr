import type { QBittorrentClient, Torrent } from "../qbittorrent/client";
import { queueMessages, type QueueDownload } from "../sonarr/queue";
import type { RulesConfig } from "./config";
import { evaluateTorrent, type TorrentVerdict } from "./evaluate";

export interface Violation {
  torrent: Torrent;
  verdict: TorrentVerdict;
}

/**
 * Evaluates every torrent in a category covered by the rules; returns how many were checked and which failed.
 * `sonarrQueue` supplies the messages for sonarrMessageRegex rulesets; torrents not in it have no messages.
 */
export async function findViolations(
  client: QBittorrentClient,
  config: RulesConfig,
  sonarrQueue: QueueDownload[] = [],
): Promise<{ checked: number; violations: Violation[] }> {
  const messagesByHash = new Map(sonarrQueue.map((d) => [d.hash, queueMessages(d)]));
  const categories = new Set(config.rules.map((r) => r.category));
  const torrents = (await client.torrents()).filter((t) => categories.has(t.category));
  const results = await Promise.all(
    torrents.map(async (torrent) => {
      const files = await client.files(torrent.hash);
      const messages = messagesByHash.get(torrent.hash.toLowerCase()) ?? [];
      return { torrent, verdict: evaluateTorrent(config, torrent.category, files.map((f) => f.name), messages) };
    }),
  );
  const violations = results.filter((r) => r.verdict.rejected);
  violations.sort((a, b) => a.torrent.added_on - b.torrent.added_on);
  return { checked: torrents.length, violations };
}

/** Short description of why a torrent was rejected: the rulesets and the first offending file. */
export function describeViolation({ verdict }: Violation): { rulesets: string; files: string } {
  const rejected = verdict.files.filter((f) => f.action === "reject");
  const first = rejected[0]!.name.split("/").pop()!;
  const more = rejected.length > 1 ? ` (+${rejected.length - 1} more)` : "";
  return { rulesets: [...new Set(rejected.map((f) => f.rulesetId))].join(", "), files: `${first}${more}` };
}
