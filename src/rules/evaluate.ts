import type { Action, RulesConfig, Ruleset } from "./config";

export interface FileVerdict {
  name: string;
  action: Action;
  /** The ruleset that decided the action; undefined when no pattern matched. */
  rulesetId?: string;
}

export interface TorrentVerdict {
  /** IDs of the rules whose category matched; empty means no rules apply. */
  ruleIds: string[];
  files: FileVerdict[];
  rejected: boolean;
}

/** Matches a pattern against the file name, or the full path if the pattern contains "/". */
export function matchesPattern(pattern: string, path: string): boolean {
  const p = pattern.toLowerCase();
  const target = (p.includes("/") ? path : path.slice(path.lastIndexOf("/") + 1)).toLowerCase();
  return new Bun.Glob(p).match(target);
}

/** The rulesets that apply to a category, in evaluation order. */
export function rulesetsFor(config: RulesConfig, category: string): { ruleIds: string[]; rulesets: Ruleset[] } {
  const byId = new Map(config.rulesets.map((r) => [r.id, r]));
  const rules = config.rules.filter((r) => r.category === category);
  return { ruleIds: rules.map((r) => r.id), rulesets: rules.flatMap((r) => r.rulesets.map((id) => byId.get(id)!)) };
}

function matchesRuleset(ruleset: Ruleset, fileName: string, messages: string[]): boolean {
  const { filePatterns, sonarrMessageRegex } = ruleset;
  if (filePatterns && !filePatterns.some((p) => matchesPattern(p, fileName))) return false;
  if (sonarrMessageRegex && !sonarrMessageRegex.some((re) => messages.some((m) => re.test(m)))) return false;
  return true;
}

/**
 * Each file starts accepted; every ruleset that matches it, in order, overrides the previous action.
 * `messages` are the torrent's Sonarr queue messages, for rulesets with sonarrMessageRegex.
 */
export function evaluateTorrent(
  config: RulesConfig,
  category: string,
  fileNames: string[],
  messages: string[] = [],
): TorrentVerdict {
  const { ruleIds, rulesets } = rulesetsFor(config, category);
  const files = fileNames.map((name): FileVerdict => {
    let verdict: FileVerdict = { name, action: "accept" };
    for (const ruleset of rulesets) {
      if (matchesRuleset(ruleset, name, messages)) {
        verdict = { name, action: ruleset.action, rulesetId: ruleset.id };
      }
    }
    return verdict;
  });
  return { ruleIds, files, rejected: files.some((f) => f.action === "reject") };
}
