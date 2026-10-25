export const DEFAULT_RULES_PATH = "ruleset.yml";

export type Action = "accept" | "reject";

/** A ruleset matches a file when every condition it specifies matches. */
export interface Ruleset {
  id: string;
  action: Action;
  /** Globs matched against each file in the torrent. */
  filePatterns?: string[];
  /** Regexes matched against the Sonarr queue messages for the torrent; a match applies to all its files. */
  sonarrMessageRegex?: RegExp[];
}

export interface Rule {
  id: string;
  category: string;
  /** Ruleset IDs, evaluated in order; the last one to match a file decides its action. */
  rulesets: string[];
}

export interface RulesConfig {
  rules: Rule[];
  rulesets: Ruleset[];
}

export async function loadRulesConfig(path: string): Promise<RulesConfig> {
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`Rules file not found: ${path}`);
  try {
    return parseRulesConfig(Bun.YAML.parse(await file.text()));
  } catch (err) {
    throw new Error(`Invalid rules file ${path}: ${err instanceof Error ? err.message : err}`);
  }
}

const isString = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function stringList(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || !value.every(isString)) throw new Error(`${where} must be a list of strings`);
  return value;
}

function list(value: unknown, where: string): Record<string, unknown>[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every((v) => v && typeof v === "object")) {
    throw new Error(`${where} must be a list`);
  }
  return value;
}

export function parseRulesConfig(raw: unknown): RulesConfig {
  if (!raw || typeof raw !== "object") throw new Error("expected a mapping with `rules` and `rulesets`");
  const doc = raw as Record<string, unknown>;

  const rulesets = list(doc.rulesets, "rulesets").map((r, i): Ruleset => {
    const where = `rulesets[${i}]`;
    if (!isString(r.id)) throw new Error(`${where}.id is required`);
    if (r.action !== "accept" && r.action !== "reject") {
      throw new Error(`${where} (${r.id}).action must be "accept" or "reject"`);
    }
    if (r.filePatterns === undefined && r.sonarrMessageRegex === undefined) {
      throw new Error(`${where} (${r.id}) needs filePatterns or sonarrMessageRegex`);
    }
    const ruleset: Ruleset = { id: r.id, action: r.action };
    if (r.filePatterns !== undefined) {
      ruleset.filePatterns = stringList(r.filePatterns, `${where} (${r.id}).filePatterns`);
    }
    if (r.sonarrMessageRegex !== undefined) {
      ruleset.sonarrMessageRegex = stringList(r.sonarrMessageRegex, `${where} (${r.id}).sonarrMessageRegex`).map(
        (source) => {
          try {
            return new RegExp(source);
          } catch (err) {
            throw new Error(`${where} (${r.id}).sonarrMessageRegex: ${err instanceof Error ? err.message : err}`);
          }
        },
      );
    }
    return ruleset;
  });

  const ids = new Set<string>();
  for (const { id } of rulesets) {
    if (ids.has(id)) throw new Error(`duplicate ruleset id "${id}"`);
    ids.add(id);
  }

  const rules = list(doc.rules, "rules").map((r, i): Rule => {
    const where = `rules[${i}]`;
    if (!isString(r.id)) throw new Error(`${where}.id is required`);
    if (!isString(r.category)) throw new Error(`${where} (${r.id}).category is required`);
    const refs = stringList(r.rulesets, `${where} (${r.id}).rulesets`);
    for (const ref of refs) {
      if (!ids.has(ref)) throw new Error(`rule "${r.id}" references unknown ruleset "${ref}"`);
    }
    return { id: r.id, category: r.category, rulesets: refs };
  });

  return { rules, rulesets };
}

/** Whether evaluating these rules needs Sonarr's queue messages. */
export function usesSonarrMessages(config: RulesConfig): boolean {
  return config.rulesets.some((r) => r.sonarrMessageRegex !== undefined);
}
