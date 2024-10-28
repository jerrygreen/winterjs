// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
/** {@linkcode parse} function for parsing
 * [JSONC](https://code.visualstudio.com/docs/languages/json#_json-with-comments)
 * (JSON with Comments) strings.
 *
 * This module is browser compatible.
 *
 * @module
 */
import { assert } from "../_util/asserts";
/**
 * Converts a JSON with Comments (JSONC) string into an object.
 * If a syntax error is found, throw a SyntaxError.
 *
 * @example
 *
 * ```ts
 * import * as JSONC from "https://deno.land/std@$STD_VERSION/encoding/jsonc";
 *
 * console.log(JSONC.parse('{"foo": "bar", } // comment')); //=> { foo: "bar" }
 * console.log(JSONC.parse('{"foo": "bar", } /* comment *\/')); //=> { foo: "bar" }
 * console.log(JSONC.parse('{"foo": "bar" } // comment', {
 *   allowTrailingComma: false,
 * })); //=> { foo: "bar" }
 * ```
 *
 * @param text A valid JSONC string.
 */
export function parse(text, { allowTrailingComma = true } = {}) {
  if (new.target) {
    throw new TypeError("parse is not a constructor");
  }
  return new JSONCParser(text, { allowTrailingComma }).parse();
}
var tokenType;
(function (tokenType) {
  tokenType[(tokenType["beginObject"] = 0)] = "beginObject";
  tokenType[(tokenType["endObject"] = 1)] = "endObject";
  tokenType[(tokenType["beginArray"] = 2)] = "beginArray";
  tokenType[(tokenType["endArray"] = 3)] = "endArray";
  tokenType[(tokenType["nameSeparator"] = 4)] = "nameSeparator";
  tokenType[(tokenType["valueSeparator"] = 5)] = "valueSeparator";
  tokenType[(tokenType["nullOrTrueOrFalseOrNumber"] = 6)] =
    "nullOrTrueOrFalseOrNumber";
  tokenType[(tokenType["string"] = 7)] = "string";
})(tokenType || (tokenType = {}));
const originalJSONParse = globalThis.JSON.parse;
// First tokenize and then parse the token.
class JSONCParser {
  #whitespace = new Set(" \t\r\n");
  #numberEndToken = new Set([..."[]{}:,/", ...this.#whitespace]);
  #text;
  #length;
  #tokenized;
  #options;
  constructor(text, options) {
    this.#text = `${text}`;
    this.#length = this.#text.length;
    this.#tokenized = this.#tokenize();
    this.#options = options;
  }
  parse() {
    const token = this.#getNext();
    const res = this.#parseJSONValue(token);
    // make sure all characters have been read
    const { done, value } = this.#tokenized.next();
    if (!done) {
      throw new SyntaxError(buildErrorMessage(value));
    }
    return res;
  }
  /** Read the next token. If the token is read to the end, it throws a SyntaxError. */
  #getNext() {
    const { done, value } = this.#tokenized.next();
    if (done) {
      throw new SyntaxError("Unexpected end of JSONC input");
    }
    return value;
  }
  /** Split the JSONC string into token units. Whitespace and comments are skipped. */
  *#tokenize() {
    for (let i = 0; i < this.#length; i++) {
      // skip whitespace
      if (this.#whitespace.has(this.#text[i])) {
        continue;
      }
      // skip multi line comment (`/*...*/`)
      if (this.#text[i] === "/" && this.#text[i + 1] === "*") {
        i += 2;
        let hasEndOfComment = false;
        for (; i < this.#length; i++) {
          // read until find `*/`
          if (this.#text[i] === "*" && this.#text[i + 1] === "/") {
            hasEndOfComment = true;
            break;
          }
        }
        if (!hasEndOfComment) {
          throw new SyntaxError("Unexpected end of JSONC input");
        }
        i++;
        continue;
      }
      // skip single line comment (`//...`)
      if (this.#text[i] === "/" && this.#text[i + 1] === "/") {
        i += 2;
        for (; i < this.#length; i++) {
          // read until find `\n` or `\r`
          if (this.#text[i] === "\n" || this.#text[i] === "\r") {
            break;
          }
        }
        continue;
      }
      switch (this.#text[i]) {
        case "{":
          yield { type: tokenType.beginObject, position: i };
          break;
        case "}":
          yield { type: tokenType.endObject, position: i };
          break;
        case "[":
          yield { type: tokenType.beginArray, position: i };
          break;
        case "]":
          yield { type: tokenType.endArray, position: i };
          break;
        case ":":
          yield { type: tokenType.nameSeparator, position: i };
          break;
        case ",":
          yield { type: tokenType.valueSeparator, position: i };
          break;
        case '"': {
          // parse string token
          const startIndex = i;
          // Need to handle consecutive backslashes correctly
          // '"\\""' => '"'
          // '"\\\\"' => '\\'
          // '"\\\\\\""' => '\\"'
          // '"\\\\\\\\"' => '\\\\'
          let shouldEscapeNext = false;
          i++;
          for (; i < this.#length; i++) {
            // read until find `"`
            if (this.#text[i] === '"' && !shouldEscapeNext) {
              break;
            }
            shouldEscapeNext = this.#text[i] === "\\" && !shouldEscapeNext;
          }
          yield {
            type: tokenType.string,
            sourceText: this.#text.substring(startIndex, i + 1),
            position: startIndex,
          };
          break;
        }
        default: {
          // parse null, true, false or number token
          const startIndex = i;
          for (; i < this.#length; i++) {
            // read until find numberEndToken
            if (this.#numberEndToken.has(this.#text[i])) {
              break;
            }
          }
          i--;
          yield {
            type: tokenType.nullOrTrueOrFalseOrNumber,
            sourceText: this.#text.substring(startIndex, i + 1),
            position: startIndex,
          };
        }
      }
    }
  }
  #parseJSONValue(value) {
    switch (value.type) {
      case tokenType.beginObject:
        return this.#parseObject();
      case tokenType.beginArray:
        return this.#parseArray();
      case tokenType.nullOrTrueOrFalseOrNumber:
        return this.#parseNullOrTrueOrFalseOrNumber(value);
      case tokenType.string:
        return this.#parseString(value);
      default:
        throw new SyntaxError(buildErrorMessage(value));
    }
  }
  #parseObject() {
    const target = {};
    //   ┌─token1
    // { }
    //      ┌─────────────token1
    //      │   ┌─────────token2
    //      │   │   ┌─────token3
    //      │   │   │   ┌─token4
    //  { "key" : value }
    //      ┌───────────────token1
    //      │   ┌───────────token2
    //      │   │   ┌───────token3
    //      │   │   │   ┌───token4
    //      │   │   │   │ ┌─token1
    //  { "key" : value , }
    //      ┌─────────────────────────────token1
    //      │   ┌─────────────────────────token2
    //      │   │   ┌─────────────────────token3
    //      │   │   │   ┌─────────────────token4
    //      │   │   │   │   ┌─────────────token1
    //      │   │   │   │   │   ┌─────────token2
    //      │   │   │   │   │   │   ┌─────token3
    //      │   │   │   │   │   │   │   ┌─token4
    //  { "key" : value , "key" : value }
    for (let isFirst = true; ; isFirst = false) {
      const token1 = this.#getNext();
      if (
        (isFirst || this.#options.allowTrailingComma) &&
        token1.type === tokenType.endObject
      ) {
        return target;
      }
      if (token1.type !== tokenType.string) {
        throw new SyntaxError(buildErrorMessage(token1));
      }
      const key = this.#parseString(token1);
      const token2 = this.#getNext();
      if (token2.type !== tokenType.nameSeparator) {
        throw new SyntaxError(buildErrorMessage(token2));
      }
      const token3 = this.#getNext();
      Object.defineProperty(target, key, {
        value: this.#parseJSONValue(token3),
        writable: true,
        enumerable: true,
        configurable: true,
      });
      const token4 = this.#getNext();
      if (token4.type === tokenType.endObject) {
        return target;
      }
      if (token4.type !== tokenType.valueSeparator) {
        throw new SyntaxError(buildErrorMessage(token4));
      }
    }
  }
  #parseArray() {
    const target = [];
    //   ┌─token1
    // [ ]
    //      ┌─────────────token1
    //      │   ┌─────────token2
    //  [ value ]
    //      ┌───────token1
    //      │   ┌───token2
    //      │   │ ┌─token1
    //  [ value , ]
    //      ┌─────────────token1
    //      │   ┌─────────token2
    //      │   │   ┌─────token1
    //      │   │   │   ┌─token2
    //  [ value , value ]
    for (let isFirst = true; ; isFirst = false) {
      const token1 = this.#getNext();
      if (
        (isFirst || this.#options.allowTrailingComma) &&
        token1.type === tokenType.endArray
      ) {
        return target;
      }
      target.push(this.#parseJSONValue(token1));
      const token2 = this.#getNext();
      if (token2.type === tokenType.endArray) {
        return target;
      }
      if (token2.type !== tokenType.valueSeparator) {
        throw new SyntaxError(buildErrorMessage(token2));
      }
    }
  }
  #parseString(value) {
    let parsed;
    try {
      // Use JSON.parse to handle `\u0000` etc. correctly.
      parsed = originalJSONParse(value.sourceText);
    } catch {
      throw new SyntaxError(buildErrorMessage(value));
    }
    assert(typeof parsed === "string");
    return parsed;
  }
  #parseNullOrTrueOrFalseOrNumber(value) {
    if (value.sourceText === "null") {
      return null;
    }
    if (value.sourceText === "true") {
      return true;
    }
    if (value.sourceText === "false") {
      return false;
    }
    let parsed;
    try {
      // Use JSON.parse to handle `+100`, `Infinity` etc. correctly.
      parsed = originalJSONParse(value.sourceText);
    } catch {
      throw new SyntaxError(buildErrorMessage(value));
    }
    assert(typeof parsed === "number");
    return parsed;
  }
}
function buildErrorMessage({ type, sourceText, position }) {
  let token = "";
  switch (type) {
    case tokenType.beginObject:
      token = "{";
      break;
    case tokenType.endObject:
      token = "}";
      break;
    case tokenType.beginArray:
      token = "[";
      break;
    case tokenType.endArray:
      token = "]";
      break;
    case tokenType.nameSeparator:
      token = ":";
      break;
    case tokenType.valueSeparator:
      token = ",";
      break;
    case tokenType.nullOrTrueOrFalseOrNumber:
    case tokenType.string:
      // Truncate the string so that it is within 30 lengths.
      token =
        30 < sourceText.length ? `${sourceText.slice(0, 30)}...` : sourceText;
      break;
    default:
      throw new Error("unreachable");
  }
  return `Unexpected token ${token} in JSONC at position ${position}`;
}
