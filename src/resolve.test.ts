import { expect, test } from "bun:test";
import { resolveHash } from "./resolve";

const torrents = [
  { hash: "e12fa01bdca5e8dd0d088e6286161d2abb705a8b", name: "one" },
  { hash: "e12fb9f7aa00000000000000000000000000000", name: "two" },
  { hash: "3f653e2df41198670f5fa0dd660b314f82120218", name: "three" },
];

test("resolves a full hash", () => {
  expect(resolveHash(torrents, "3f653e2df41198670f5fa0dd660b314f82120218").name).toBe("three");
});

test("resolves a unique prefix, ignoring case and whitespace", () => {
  expect(resolveHash(torrents, " E12FA0 ").name).toBe("one");
});

test("resolves a Usenet GUID with dashes", () => {
  const guid = { hash: "f84970a3-e846-4735-a7a3-ad93dd7882f9", name: "usenet" };
  expect(resolveHash([...torrents, guid], "f84970a3-e846-4735-a7a3-ad93dd7882f9").name).toBe("usenet");
  expect(resolveHash([...torrents, guid], "f84970a3-e8").name).toBe("usenet");
});

test("rejects an ambiguous prefix", () => {
  expect(() => resolveHash(torrents, "e12f")).toThrow("matches 2 torrents");
});

test("rejects an unknown prefix", () => {
  expect(() => resolveHash(torrents, "abc")).toThrow("No torrent matches");
});

test("rejects input that is not hex", () => {
  expect(() => resolveHash(torrents, "")).toThrow("Not a valid hash");
  expect(() => resolveHash(torrents, "xyz")).toThrow("Not a valid hash");
});
