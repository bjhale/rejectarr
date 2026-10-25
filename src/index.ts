#!/usr/bin/env bun
import { qbtInfo } from "./commands/qbt-info";
import { qbtList } from "./commands/qbt-list";
import { rulesExecute } from "./commands/rules-execute";
import { rulesRemove } from "./commands/rules-remove";
import { sonarrInfo } from "./commands/sonarr-info";
import { sonarrList } from "./commands/sonarr-list";

const commands: Record<string, { description: string; run: (args: string[]) => Promise<void> }> = {
  "qbt:list": { description: "List all torrents in the qBittorrent queue", run: qbtList },
  "qbt:info": { description: "Show details for one torrent: qbt:info <hash or hash prefix>", run: qbtInfo },
  "sonarr:list": { description: "List all downloads in the Sonarr queue", run: sonarrList },
  "sonarr:info": { description: "Show details for one Sonarr download: sonarr:info <hash or hash prefix>", run: sonarrInfo },
  "rules:execute": { description: "Find torrents that violate the rules: rules:execute [ruleset.yml]", run: rulesExecute },
  "rules:remove": {
    description: "Remove violating downloads from Sonarr, blocklist and search: rules:remove [ruleset.yml] [--dry-run] [--yes]",
    run: rulesRemove,
  },
};

function usage(): void {
  console.log("Usage: rejectarr <command>\n\nCommands:");
  const width = Math.max(...Object.keys(commands).map((name) => name.length));
  for (const [name, { description }] of Object.entries(commands)) {
    console.log(`  ${name.padEnd(width)}  ${description}`);
  }
}

const [name, ...args] = Bun.argv.slice(2);
if (!name || name === "help" || name === "--help" || name === "-h") {
  usage();
  process.exit(0);
}

const command = commands[name];
if (!command) {
  console.error(`Unknown command: ${name}\n`);
  usage();
  process.exit(1);
}

try {
  await command.run(args);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
