import { expect, test } from "bun:test";
import { formatBytes, formatTable } from "./format";

test("formatBytes", () => {
  expect(formatBytes(0)).toBe("0 B");
  expect(formatBytes(1023)).toBe("1023 B");
  expect(formatBytes(1536)).toBe("1.5 KiB");
  expect(formatBytes(5 * 1024 ** 3)).toBe("5.0 GiB");
});

test("formatTable pads columns to the widest cell", () => {
  expect(formatTable(["A", "B"], [["long", "x"], ["s", "yy"]])).toBe(
    ["A     B", "----  --", "long  x", "s     yy"].join("\n"),
  );
});

test("formatTable shrinks the flex column to fit maxWidth", () => {
  const out = formatTable(["Name", "N"], [["abcdefghij", "1"]], { maxWidth: 10, flexColumns: [0] });
  expect(out).toBe(["Name     N", "-------  -", "abcdef…  1"].join("\n"));
  expect(out.split("\n").every((l) => l.length <= 10)).toBe(true);
});

test("formatTable shrinks several flex columns widest-first", () => {
  const out = formatTable(["A", "B"], [["aaaaaaaaaa", "bbbbbb"]], { maxWidth: 12, flexColumns: [0, 1] });
  expect(out.split("\n")[2]).toBe("aaaa…  bbbb…");
});

test("formatTable does not shrink the flex column below its header", () => {
  const out = formatTable(["Name", "N"], [["abcdefghij", "1"]], { maxWidth: 3, flexColumns: [0] });
  expect(out.split("\n")[2]).toBe("abc…  1");
});
