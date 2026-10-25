import { qbittorrentConfig, sonarrConfig } from "../config";
import { formatTable } from "../format";
import { QBittorrentClient } from "../qbittorrent/client";
import { DEFAULT_RULES_PATH, loadRulesConfig, usesSonarrMessages } from "../rules/config";
import { describeViolation, findViolations } from "../rules/violations";
import { SonarrClient } from "../sonarr/client";
import { groupQueue, type QueueDownload } from "../sonarr/queue";

export async function rulesExecute(args: string[]): Promise<void> {
  const path = args[0] ?? DEFAULT_RULES_PATH;
  const config = await loadRulesConfig(path);

  const { host, username, password } = qbittorrentConfig();
  let queue: QueueDownload[] = [];
  if (usesSonarrMessages(config)) {
    const sonarr = sonarrConfig();
    queue = groupQueue(await new SonarrClient(sonarr.host, sonarr.apiKey).queue());
  }
  const { checked, violations } = await findViolations(new QBittorrentClient(host, username, password), config, queue);

  console.log(`Checked ${checked} torrent(s) in categories covered by ${path}.`);
  if (violations.length === 0) {
    console.log("No violations.");
    return;
  }

  const rows = violations.map((v) => {
    const { rulesets, files } = describeViolation(v);
    return [v.torrent.hash.slice(0, 8), v.torrent.name, v.torrent.category, rulesets, files];
  });
  const headers = ["Hash", "Name", "Category", "Rejected by", "Files"];
  console.log(`\n${formatTable(headers, rows, { maxWidth: process.stdout.columns, flexColumns: [1, 4] })}`);
  console.log(`\n${violations.length} torrent(s) violate the rules`);
}
