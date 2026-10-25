import { qbittorrentConfig, sonarrConfig } from "../config";
import { formatTable } from "../format";
import { QBittorrentClient } from "../qbittorrent/client";
import { DEFAULT_RULES_PATH, loadRulesConfig } from "../rules/config";
import { describeViolation, findViolations } from "../rules/violations";
import { SonarrClient } from "../sonarr/client";
import { groupQueue } from "../sonarr/queue";

const USAGE = "Usage: rejectarr rules:remove [ruleset.yml] [--dry-run] [--yes]";

function parseArgs(args: string[]) {
  const options = { path: DEFAULT_RULES_PATH, dryRun: false, yes: false };
  const positional: string[] = [];
  for (const arg of args) {
    if (arg === "--dry-run" || arg === "-n") options.dryRun = true;
    else if (arg === "--yes" || arg === "-y") options.yes = true;
    else if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}\n${USAGE}`);
    else positional.push(arg);
  }
  if (positional.length > 1) throw new Error(USAGE);
  if (positional[0]) options.path = positional[0];
  return options;
}

export async function rulesRemove(args: string[]): Promise<void> {
  const { path, dryRun, yes } = parseArgs(args);
  const config = await loadRulesConfig(path);

  const qbt = qbittorrentConfig();
  const sonarrSettings = sonarrConfig();
  const sonarr = new SonarrClient(sonarrSettings.host, sonarrSettings.apiKey);
  const queue = groupQueue(await sonarr.queue());
  const { checked, violations } = await findViolations(
    new QBittorrentClient(qbt.host, qbt.username, qbt.password),
    config,
    queue,
  );

  console.log(`Checked ${checked} torrent(s) in categories covered by ${path}.`);
  if (violations.length === 0) {
    console.log("No violations.");
    return;
  }

  const byHash = new Map(queue.map((d) => [d.hash, d]));
  const targets = violations.flatMap((v) => {
    const download = byHash.get(v.torrent.hash.toLowerCase());
    return download ? [{ violation: v, download }] : [];
  });
  const unmanaged = violations.filter((v) => !byHash.has(v.torrent.hash.toLowerCase()));

  if (targets.length > 0) {
    const rows = targets.map(({ violation, download }) => {
      const { rulesets, files } = describeViolation(violation);
      return [download.hash.slice(0, 8), download.name, rulesets, files];
    });
    console.log(`\nTo remove from the Sonarr queue, delete from qBittorrent, blocklist, and search again:`);
    const headers = ["Hash", "Title", "Rejected by", "Files"];
    console.log(formatTable(headers, rows, { maxWidth: process.stdout.columns, flexColumns: [1, 3] }));
  }
  if (unmanaged.length > 0) {
    console.log(`\nSkipping ${unmanaged.length} violating torrent(s) not in the Sonarr queue:`);
    for (const v of unmanaged) console.log(`  ${v.torrent.hash.slice(0, 8)}  ${v.torrent.name}`);
  }
  if (targets.length === 0) {
    console.log("\nNothing to remove.");
    return;
  }

  if (dryRun) {
    console.log(`\nDry run: ${targets.length} download(s) would be removed.`);
    return;
  }
  if (!yes) {
    if (!process.stdin.isTTY) throw new Error("Refusing to remove without confirmation; pass --yes to skip the prompt.");
    const answer = prompt(`\nRemove and blocklist ${targets.length} download(s)? [y/N]`);
    if (answer?.trim().toLowerCase() !== "y") {
      console.log("Cancelled.");
      return;
    }
  }

  let failed = 0;
  for (const { download } of targets) {
    try {
      await sonarr.removeAndBlocklist(download.records.map((r) => r.id));
      console.log(`Removed   ${download.hash.slice(0, 8)}  ${download.name}`);
    } catch (err) {
      failed++;
      console.error(`Failed    ${download.hash.slice(0, 8)}  ${download.name}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\nRemoved ${targets.length - failed} of ${targets.length} download(s).`);
  if (failed > 0) process.exitCode = 1;
}
