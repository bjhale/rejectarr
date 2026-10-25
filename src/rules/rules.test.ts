import { describe, expect, test } from "bun:test";
import { parseRulesConfig, type RulesConfig } from "./config";
import { evaluateTorrent, matchesPattern } from "./evaluate";

const config: RulesConfig = parseRulesConfig({
  rules: [
    { id: "tv", category: "tv-shows", rulesets: ["archives", "allow-subs-zip"] },
    { id: "tv-exe", category: "tv-shows", rulesets: ["exe"] },
    { id: "movies", category: "movies", rulesets: ["allow-subs-zip", "archives"] },
  ],
  rulesets: [
    { id: "exe", action: "reject", filePatterns: ["*.exe"] },
    { id: "archives", action: "reject", filePatterns: ["*.zip", "*.rar"] },
    { id: "allow-subs-zip", action: "accept", filePatterns: ["subs.zip"] },
  ],
});

describe("matchesPattern", () => {
  test("matches the file name regardless of folder and case", () => {
    expect(matchesPattern("*.exe", "Show S01/Show.S01E01.EXE")).toBe(true);
    expect(matchesPattern("*.exe", "Show S01/Show.S01E01.mkv")).toBe(false);
  });

  test("matches names disguised with trailing dots, spaces, or full-width characters", () => {
    expect(matchesPattern("*.exe", "Show/x.exe.")).toBe(true);
    expect(matchesPattern("*.exe", "Show/x.exe . ")).toBe(true);
    expect(matchesPattern("*.exe", "Show/ｘ．ｅｘｅ")).toBe(true);
    expect(matchesPattern("*/sample/*", "Show/Sample. /clip.mkv")).toBe(true);
  });

  test("matches the full path when the pattern has a slash", () => {
    expect(matchesPattern("sample/*", "Show/sample/clip.mkv")).toBe(false);
    expect(matchesPattern("*/sample/*", "Show/sample/clip.mkv")).toBe(true);
  });
});

describe("evaluateTorrent", () => {
  test("accepts files no ruleset matches", () => {
    const v = evaluateTorrent(config, "tv-shows", ["Show/ep.mkv"]);
    expect(v).toEqual({ ruleIds: ["tv", "tv-exe"], files: [{ name: "Show/ep.mkv", action: "accept" }], rejected: false });
  });

  test("rejects a torrent when any file is rejected", () => {
    const v = evaluateTorrent(config, "tv-shows", ["Show/ep.mkv", "Show/ep.exe"]);
    expect(v.rejected).toBe(true);
    expect(v.files[1]).toEqual({ name: "Show/ep.exe", action: "reject", rulesetId: "exe" });
  });

  test("a later accept overrides an earlier reject", () => {
    const v = evaluateTorrent(config, "tv-shows", ["subs.zip", "other.zip"]);
    expect(v.files.map((f) => [f.action, f.rulesetId])).toEqual([["accept", "allow-subs-zip"], ["reject", "archives"]]);
  });

  test("a later reject overrides an earlier accept", () => {
    const v = evaluateTorrent(config, "movies", ["subs.zip"]);
    expect(v.files[0]).toMatchObject({ action: "reject", rulesetId: "archives" });
  });

  test("categories without rules accept everything", () => {
    const v = evaluateTorrent(config, "TV Shows", ["x.exe"]);
    expect(v).toMatchObject({ ruleIds: [], rejected: false });
  });
});

describe("sonarrMessageRegex", () => {
  const CANT_IMPORT = "No files found are eligible for import in /media/Show.exe";
  const messageConfig = parseRulesConfig({
    rules: [
      { id: "tv", category: "tv", rulesets: ["cant-import"] },
      { id: "tv-allow", category: "tv-allow", rulesets: ["cant-import", "allow-mkv"] },
      { id: "tv-both", category: "tv-both", rulesets: ["exe-cant-import"] },
    ],
    rulesets: [
      { id: "cant-import", action: "reject", sonarrMessageRegex: [".*No files found are eligible for import.*"] },
      { id: "allow-mkv", action: "accept", filePatterns: ["*.mkv"] },
      { id: "exe-cant-import", action: "reject", filePatterns: ["*.exe"], sonarrMessageRegex: ["eligible for import"] },
    ],
  });

  test("a matching message rejects every file in the torrent", () => {
    const v = evaluateTorrent(messageConfig, "tv", ["a.mkv", "b.nfo"], ["other", CANT_IMPORT]);
    expect(v.rejected).toBe(true);
    expect(v.files.every((f) => f.action === "reject" && f.rulesetId === "cant-import")).toBe(true);
  });

  test("no matching message accepts", () => {
    expect(evaluateTorrent(messageConfig, "tv", ["a.mkv"], ["Downloading"]).rejected).toBe(false);
    expect(evaluateTorrent(messageConfig, "tv", ["a.mkv"]).rejected).toBe(false);
  });

  test("a later file accept overrides a message reject", () => {
    const v = evaluateTorrent(messageConfig, "tv-allow", ["a.mkv", "b.exe"], [CANT_IMPORT]);
    expect(v.files.map((f) => f.action)).toEqual(["accept", "reject"]);
  });

  test("a ruleset with both conditions needs both to match", () => {
    expect(evaluateTorrent(messageConfig, "tv-both", ["a.exe"], []).rejected).toBe(false);
    expect(evaluateTorrent(messageConfig, "tv-both", ["a.mkv"], [CANT_IMPORT]).rejected).toBe(false);
    expect(evaluateTorrent(messageConfig, "tv-both", ["a.exe"], [CANT_IMPORT]).rejected).toBe(true);
  });

  test("invalid regexes and empty rulesets are rejected", () => {
    expect(() => parseRulesConfig({ rulesets: [{ id: "x", action: "reject", sonarrMessageRegex: ["("] }] })).toThrow(
      "(x).sonarrMessageRegex",
    );
    expect(() => parseRulesConfig({ rulesets: [{ id: "x", action: "reject" }] })).toThrow(
      "needs filePatterns or sonarrMessageRegex",
    );
  });
});

describe("parseRulesConfig", () => {
  test("rejects unknown ruleset references", () => {
    expect(() => parseRulesConfig({ rules: [{ id: "r", category: "c", rulesets: ["nope"] }], rulesets: [] })).toThrow(
      'references unknown ruleset "nope"',
    );
  });

  test("rejects invalid actions", () => {
    expect(() => parseRulesConfig({ rulesets: [{ id: "x", action: "delete", filePatterns: [] }] })).toThrow(
      'must be "accept" or "reject"',
    );
  });

  test("rejects duplicate ruleset ids", () => {
    const dup = { id: "x", action: "reject", filePatterns: ["*"] };
    expect(() => parseRulesConfig({ rulesets: [dup, dup] })).toThrow('duplicate ruleset id "x"');
  });
});
