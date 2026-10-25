import { expect, test } from "bun:test";
import type { QueueRecord } from "./client";
import { formatEpisodes, groupQueue } from "./queue";

function record(id: number, downloadId: string | undefined, season?: number, episode?: number): QueueRecord {
  return {
    id,
    downloadId,
    title: `title-${downloadId ?? id}`,
    episode: season === undefined ? undefined : { seasonNumber: season, episodeNumber: episode!, title: "" },
  } as QueueRecord;
}

test("groupQueue merges records that share a download ID and lowercases the hash", () => {
  const groups = groupQueue([record(1, "ABC", 1, 1), record(2, "ABC", 1, 2), record(3, "DEF", 2, 1)]);
  expect(groups.map((g) => [g.hash, g.records.length])).toEqual([["abc", 2], ["def", 1]]);
});

test("groupQueue keeps records without a download ID separate", () => {
  const groups = groupQueue([record(1, undefined), record(2, undefined)]);
  expect(groups.map((g) => g.hash)).toEqual(["queue-1", "queue-2"]);
});

test("formatEpisodes", () => {
  expect(formatEpisodes([record(1, "a")])).toBe("-");
  expect(formatEpisodes([record(1, "a", 29, 3)])).toBe("S29E03");
  expect(formatEpisodes([record(2, "a", 13, 2), record(1, "a", 13, 1), record(3, "a", 13, 3)])).toBe("S13E01-E03");
  expect(formatEpisodes([record(1, "a", 1, 1), record(2, "a", 1, 3)])).toBe("S01E01,S01E03");
});
