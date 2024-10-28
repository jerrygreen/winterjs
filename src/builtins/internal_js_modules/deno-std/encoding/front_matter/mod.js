// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// Copyright (c) Jason Campbell. MIT license
export var Format;
(function (Format) {
  Format["YAML"] = "yaml";
  Format["TOML"] = "toml";
  Format["JSON"] = "json";
  Format["UNKNOWN"] = "unknown";
})(Format || (Format = {}));
const { isArray } = Array;
const [RX_RECOGNIZE_YAML, RX_YAML] = createRegExp(
  ["---yaml", "---"],
  "= yaml =",
  "---"
);
const [RX_RECOGNIZE_TOML, RX_TOML] = createRegExp(
  ["---toml", "---"],
  "= toml ="
);
const [RX_RECOGNIZE_JSON, RX_JSON] = createRegExp(
  ["---json", "---"],
  "= json ="
);
const MAP_FORMAT_TO_RECOGNIZER_RX = {
  [Format.YAML]: RX_RECOGNIZE_YAML,
  [Format.TOML]: RX_RECOGNIZE_TOML,
  [Format.JSON]: RX_RECOGNIZE_JSON,
};
const MAP_FORMAT_TO_EXTRACTOR_RX = {
  [Format.YAML]: RX_YAML,
  [Format.TOML]: RX_TOML,
  [Format.JSON]: RX_JSON,
};
function getBeginToken(delimiter) {
  return isArray(delimiter) ? delimiter[0] : delimiter;
}
function getEndToken(delimiter) {
  return isArray(delimiter) ? delimiter[1] : delimiter;
}
function createRegExp(...dv) {
  const beginPattern = "(" + dv.map(getBeginToken).join("|") + ")";
  const pattern =
    "^(" +
    "\\ufeff?" + // Maybe byte order mark
    beginPattern +
    "$([\\s\\S]+?)" +
    "^(?:" +
    dv.map(getEndToken).join("|") +
    ")\\s*" +
    "$" +
    (globalThis?.Deno?.build?.os === "windows" ? "\\r?" : "") +
    "(?:\\n)?)";
  return [
    new RegExp("^" + beginPattern + "$", "im"),
    new RegExp(pattern, "im"),
  ];
}
function _extract(str, rx, parse) {
  const match = rx.exec(str);
  if (!match || match.index !== 0) {
    throw new TypeError("Unexpected end of input");
  }
  const frontMatter = match.at(-1)?.replace(/^\s+|\s+$/g, "") || "";
  const attrs = parse(frontMatter);
  const body = str.replace(match[0], "");
  return { frontMatter, body, attrs };
}
/**
 * Factory that creates a function that extracts front matter from a string with the given parsers.
 * Supports YAML, TOML and JSON.
 *
 * @param formats A descriptor containing Format-parser pairs to use for each format.
 * @returns A function that extracts front matter from a string with the given parsers.
 *
 * ```ts
 * import { createExtractor, Format, Parser } from "https://deno.land/std@$STD_VERSION/encoding/front_matter/mod";
 * import { assertEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts";
 * import { parse as parseYAML } from "https://deno.land/std@$STD_VERSION/encoding/yaml";
 * import { parse as parseTOML } from "https://deno.land/std@$STD_VERSION/encoding/toml";
 * const extractYAML = createExtractor({ [Format.YAML]: parseYAML as Parser });
 * const extractTOML = createExtractor({ [Format.TOML]: parseTOML as Parser });
 * const extractJSON = createExtractor({ [Format.JSON]: JSON.parse as Parser });
 * const extractYAMLOrJSON = createExtractor({
 *     [Format.YAML]: parseYAML as Parser,
 *     [Format.JSON]: JSON.parse as Parser,
 * });
 *
 * let { attrs, body, frontMatter } = extractYAML<{ title: string }>("---\ntitle: Three dashes marks the spot\n---\nferret");
 * assertEquals(attrs.title, "Three dashes marks the spot");
 * assertEquals(body, "ferret");
 * assertEquals(frontMatter, "title: Three dashes marks the spot");
 *
 * ({ attrs, body, frontMatter } = extractTOML<{ title: string }>("---toml\ntitle = 'Three dashes followed by format marks the spot'\n---\n"));
 * assertEquals(attrs.title, "Three dashes followed by format marks the spot");
 * assertEquals(body, "");
 * assertEquals(frontMatter, "title = 'Three dashes followed by format marks the spot'");
 *
 * ({ attrs, body, frontMatter } = extractJSON<{ title: string }>("---json\n{\"title\": \"Three dashes followed by format marks the spot\"}\n---\ngoat"));
 * assertEquals(attrs.title, "Three dashes followed by format marks the spot");
 * assertEquals(body, "goat");
 * assertEquals(frontMatter, "{\"title\": \"Three dashes followed by format marks the spot\"}");
 *
 * ({ attrs, body, frontMatter } = extractYAMLOrJSON<{ title: string }>("---\ntitle: Three dashes marks the spot\n---\nferret"));
 * assertEquals(attrs.title, "Three dashes marks the spot");
 * assertEquals(body, "ferret");
 * assertEquals(frontMatter, "title: Three dashes marks the spot");
 *
 * ({ attrs, body, frontMatter } = extractYAMLOrJSON<{ title: string }>("---json\n{\"title\": \"Three dashes followed by format marks the spot\"}\n---\ngoat"));
 * assertEquals(attrs.title, "Three dashes followed by format marks the spot");
 * assertEquals(body, "goat");
 * assertEquals(frontMatter, "{\"title\": \"Three dashes followed by format marks the spot\"}");
 * ```
 */
export function createExtractor(formats) {
  const formatKeys = Object.keys(formats);
  return function extract(str) {
    const format = recognize(str, formatKeys);
    const parser = formats[format];
    if (format === Format.UNKNOWN || !parser) {
      throw new TypeError(`Unsupported front matter format`);
    }
    return _extract(str, MAP_FORMAT_TO_EXTRACTOR_RX[format], parser);
  };
}
/**
 * Tests if a string has valid front matter. Supports YAML, TOML and JSON.
 *
 * @param str String to test.
 * @param formats A list of formats to test for. Defaults to all supported formats.
 *
 * ```ts
 * import { test, Format } from "https://deno.land/std@$STD_VERSION/encoding/front_matter/mod";
 * import { assert } from "https://deno.land/std@$STD_VERSION/testing/asserts";
 *
 * assert(test("---\ntitle: Three dashes marks the spot\n---\n"));
 * assert(test("---toml\ntitle = 'Three dashes followed by format marks the spot'\n---\n"));
 * assert(test("---json\n{\"title\": \"Three dashes followed by format marks the spot\"}\n---\n"));
 *
 * assert(!test("---json\n{\"title\": \"Three dashes followed by format marks the spot\"}\n---\n", [Format.YAML]));
 * ```
 */
export function test(str, formats) {
  if (!formats) {
    formats = Object.keys(MAP_FORMAT_TO_EXTRACTOR_RX);
  }
  for (const format of formats) {
    if (format === Format.UNKNOWN) {
      throw new TypeError("Unable to test for unknown front matter format");
    }
    const match = MAP_FORMAT_TO_EXTRACTOR_RX[format].exec(str);
    if (match?.index === 0) {
      return true;
    }
  }
  return false;
}
/**
 * Recognizes the format of the front matter in a string. Supports YAML, TOML and JSON.
 *
 * @param str String to recognize.
 * @param formats A list of formats to recognize. Defaults to all supported formats.
 *
 * ```ts
 * import { recognize, Format } from "https://deno.land/std@$STD_VERSION/encoding/front_matter/mod";
 * import { assertEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts";
 *
 * assertEquals(recognize("---\ntitle: Three dashes marks the spot\n---\n"), Format.YAML);
 * assertEquals(recognize("---toml\ntitle = 'Three dashes followed by format marks the spot'\n---\n"), Format.TOML);
 * assertEquals(recognize("---json\n{\"title\": \"Three dashes followed by format marks the spot\"}\n---\n"), Format.JSON);
 * assertEquals(recognize("---xml\n<title>Three dashes marks the spot</title>\n---\n"), Format.UNKNOWN);
 *
 * assertEquals(recognize("---json\n<title>Three dashes marks the spot</title>\n---\n", [Format.YAML]), Format.UNKNOWN);
 */
function recognize(str, formats) {
  if (!formats) {
    formats = Object.keys(MAP_FORMAT_TO_RECOGNIZER_RX);
  }
  const [firstLine] = str.split(/(\r?\n)/);
  for (const format of formats) {
    if (format === Format.UNKNOWN) {
      continue;
    }
    if (MAP_FORMAT_TO_RECOGNIZER_RX[format].test(firstLine)) {
      return format;
    }
  }
  return Format.UNKNOWN;
}
