/** Finds the one item whose hash starts with `input` (case-insensitive). */
export function resolveHash<T extends { hash: string; name: string }>(
  items: T[],
  input: string,
  noun = "torrent",
): T {
  const prefix = input.trim().toLowerCase();
  // Torrent hashes are hex; Usenet clients such as SABnzbd use GUIDs, which add dashes.
  if (!/^[0-9a-f][0-9a-f-]*$/.test(prefix)) throw new Error(`Not a valid hash: ${input}`);

  const matches = items.filter((t) => t.hash.toLowerCase().startsWith(prefix));
  if (matches.length === 0) throw new Error(`No ${noun} matches hash ${input}`);
  if (matches.length > 1) {
    const list = matches.map((t) => `  ${t.hash}  ${t.name}`).join("\n");
    throw new Error(`Hash ${input} matches ${matches.length} ${noun}s; use more characters:\n${list}`);
  }
  return matches[0]!;
}
