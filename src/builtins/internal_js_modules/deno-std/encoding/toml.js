// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
/**
 * {@linkcode parse} and {@linkcode stringify} for handling
 * [TOML](https://toml.io/en/latest) encoded data. Be sure to read the supported
 * types as not every spec is supported at the moment and the handling in
 * TypeScript side is a bit different.
 *
 * ## Supported types and handling
 *
 * - :heavy_check_mark: [Keys](https://toml.io/en/latest#keys)
 * - :exclamation: [String](https://toml.io/en/latest#string)
 * - :heavy_check_mark: [Multiline String](https://toml.io/en/latest#string)
 * - :heavy_check_mark: [Literal String](https://toml.io/en/latest#string)
 * - :exclamation: [Integer](https://toml.io/en/latest#integer)
 * - :heavy_check_mark: [Float](https://toml.io/en/latest#float)
 * - :heavy_check_mark: [Boolean](https://toml.io/en/latest#boolean)
 * - :heavy_check_mark:
 *   [Offset Date-time](https://toml.io/en/latest#offset-date-time)
 * - :heavy_check_mark:
 *   [Local Date-time](https://toml.io/en/latest#local-date-time)
 * - :heavy_check_mark: [Local Date](https://toml.io/en/latest#local-date)
 * - :exclamation: [Local Time](https://toml.io/en/latest#local-time)
 * - :heavy_check_mark: [Table](https://toml.io/en/latest#table)
 * - :heavy_check_mark: [Inline Table](https://toml.io/en/latest#inline-table)
 * - :exclamation: [Array of Tables](https://toml.io/en/latest#array-of-tables)
 *
 * :exclamation: _Supported with warnings see [Warning](#Warning)._
 *
 * ### :warning: Warning
 *
 * #### String
 *
 * - Regex : Due to the spec, there is no flag to detect regex properly in a TOML
 *   declaration. So the regex is stored as string.
 *
 * #### Integer
 *
 * For **Binary** / **Octal** / **Hexadecimal** numbers, they are stored as string
 * to be not interpreted as Decimal.
 *
 * #### Local Time
 *
 * Because local time does not exist in JavaScript, the local time is stored as a
 * string.
 *
 * #### Inline Table
 *
 * Inline tables are supported. See below:
 *
 * ```toml
 * animal = { type = { name = "pug" } }
 * ## Output { animal: { type: { name: "pug" } } }
 * animal = { type.name = "pug" }
 * ## Output { animal: { type : { name : "pug" } }
 * animal.as.leaders = "tosin"
 * ## Output { animal: { as: { leaders: "tosin" } } }
 * "tosin.abasi" = "guitarist"
 * ## Output { tosin.abasi: "guitarist" }
 * ```
 *
 * #### Array of Tables
 *
 * At the moment only simple declarations like below are supported:
 *
 * ```toml
 * [[bin]]
 * name = "deno"
 * path = "cli/main.rs"
 *
 * [[bin]]
 * name = "deno_core"
 * path = "src/foo.rs"
 *
 * [[nib]]
 * name = "node"
 * path = "not_found"
 * ```
 *
 * will output:
 *
 * ```json
 * {
 *   "bin": [
 *     { "name": "deno", "path": "cli/main.rs" },
 *     { "name": "deno_core", "path": "src/foo.rs" }
 *   ],
 *   "nib": [{ "name": "node", "path": "not_found" }]
 * }
 * ```
 *
 * This module is browser compatible.
 *
 * @example
 * ```ts
 * import {
 *   parse,
 *   stringify,
 * } from "https://deno.land/std@$STD_VERSION/encoding/toml";
 * const obj = {
 *   bin: [
 *     { name: "deno", path: "cli/main.rs" },
 *     { name: "deno_core", path: "src/foo.rs" },
 *   ],
 *   nib: [{ name: "node", path: "not_found" }],
 * };
 * const tomlString = stringify(obj);
 * console.log(tomlString);
 *
 * // =>
 * // [[bin]]
 * // name = "deno"
 * // path = "cli/main.rs"
 *
 * // [[bin]]
 * // name = "deno_core"
 * // path = "src/foo.rs"
 *
 * // [[nib]]
 * // name = "node"
 * // path = "not_found"
 *
 * const tomlObject = parse(tomlString);
 * console.log(tomlObject);
 *
 * // =>
 * // {
 * //   bin: [
 * //     { name: "deno", path: "cli/main.rs" },
 * //     { name: "deno_core", path: "src/foo.rs" }
 * //   ],
 * //   nib: [ { name: "node", path: "not_found" } ]
 * // }
 * ```
 *
 * @module
 */
export { parse } from "./_toml/parser";
// Bare keys may only contain ASCII letters,
// ASCII digits, underscores, and dashes (A-Za-z0-9_-).
function joinKeys(keys) {
  // Dotted keys are a sequence of bare or quoted keys joined with a dot.
  // This allows for grouping similar properties together:
  return keys
    .map((str) => {
      return str.match(/[^A-Za-z0-9_-]/) ? JSON.stringify(str) : str;
    })
    .join(".");
}
var ArrayType;
(function (ArrayType) {
  ArrayType[(ArrayType["ONLY_PRIMITIVE"] = 0)] = "ONLY_PRIMITIVE";
  ArrayType[(ArrayType["ONLY_OBJECT_EXCLUDING_ARRAY"] = 1)] =
    "ONLY_OBJECT_EXCLUDING_ARRAY";
  ArrayType[(ArrayType["MIXED"] = 2)] = "MIXED";
})(ArrayType || (ArrayType = {}));
class Dumper {
  maxPad = 0;
  srcObject;
  output = [];
  #arrayTypeCache = new Map();
  constructor(srcObjc) {
    this.srcObject = srcObjc;
  }
  dump(fmtOptions = {}) {
    // deno-lint-ignore no-explicit-any
    this.output = this.#printObject(this.srcObject);
    this.output = this.#format(fmtOptions);
    return this.output;
  }
  #printObject(obj, keys = []) {
    const out = [];
    const props = Object.keys(obj);
    const inlineProps = [];
    const multilineProps = [];
    for (const prop of props) {
      if (this.#isSimplySerializable(obj[prop])) {
        inlineProps.push(prop);
      } else {
        multilineProps.push(prop);
      }
    }
    const sortedProps = inlineProps.concat(multilineProps);
    for (let i = 0; i < sortedProps.length; i++) {
      const prop = sortedProps[i];
      const value = obj[prop];
      if (value instanceof Date) {
        out.push(this.#dateDeclaration([prop], value));
      } else if (typeof value === "string" || value instanceof RegExp) {
        out.push(this.#strDeclaration([prop], value.toString()));
      } else if (typeof value === "number") {
        out.push(this.#numberDeclaration([prop], value));
      } else if (typeof value === "boolean") {
        out.push(this.#boolDeclaration([prop], value));
      } else if (value instanceof Array) {
        const arrayType = this.#getTypeOfArray(value);
        if (arrayType === ArrayType.ONLY_PRIMITIVE) {
          out.push(this.#arrayDeclaration([prop], value));
        } else if (arrayType === ArrayType.ONLY_OBJECT_EXCLUDING_ARRAY) {
          // array of objects
          for (let i = 0; i < value.length; i++) {
            out.push("");
            out.push(this.#headerGroup([...keys, prop]));
            out.push(...this.#printObject(value[i], [...keys, prop]));
          }
        } else {
          // this is a complex array, use the inline format.
          const str = value.map((x) => this.#printAsInlineValue(x)).join(",");
          out.push(`${this.#declaration([prop])}[${str}]`);
        }
      } else if (typeof value === "object") {
        out.push("");
        out.push(this.#header([...keys, prop]));
        if (value) {
          const toParse = value;
          out.push(...this.#printObject(toParse, [...keys, prop]));
        }
        // out.push(...this._parse(value, `${path}${prop}.`));
      }
    }
    out.push("");
    return out;
  }
  #isPrimitive(value) {
    return (
      value instanceof Date ||
      value instanceof RegExp ||
      ["string", "number", "boolean"].includes(typeof value)
    );
  }
  #getTypeOfArray(arr) {
    if (this.#arrayTypeCache.has(arr)) {
      return this.#arrayTypeCache.get(arr);
    }
    const type = this.#doGetTypeOfArray(arr);
    this.#arrayTypeCache.set(arr, type);
    return type;
  }
  #doGetTypeOfArray(arr) {
    if (!arr.length) {
      // any type should be fine
      return ArrayType.ONLY_PRIMITIVE;
    }
    const onlyPrimitive = this.#isPrimitive(arr[0]);
    if (arr[0] instanceof Array) {
      return ArrayType.MIXED;
    }
    for (let i = 1; i < arr.length; i++) {
      if (
        onlyPrimitive !== this.#isPrimitive(arr[i]) ||
        arr[i] instanceof Array
      ) {
        return ArrayType.MIXED;
      }
    }
    return onlyPrimitive
      ? ArrayType.ONLY_PRIMITIVE
      : ArrayType.ONLY_OBJECT_EXCLUDING_ARRAY;
  }
  #printAsInlineValue(value) {
    if (value instanceof Date) {
      return `"${this.#printDate(value)}"`;
    } else if (typeof value === "string" || value instanceof RegExp) {
      return JSON.stringify(value.toString());
    } else if (typeof value === "number") {
      return value;
    } else if (typeof value === "boolean") {
      return value.toString();
    } else if (value instanceof Array) {
      const str = value.map((x) => this.#printAsInlineValue(x)).join(",");
      return `[${str}]`;
    } else if (typeof value === "object") {
      if (!value) {
        throw new Error("should never reach");
      }
      const str = Object.keys(value)
        .map((key) => {
          // deno-lint-ignore no-explicit-any
          return `${key} = ${this.#printAsInlineValue(value[key])}`;
        })
        .join(",");
      return `{${str}}`;
    }
    throw new Error("should never reach");
  }
  #isSimplySerializable(value) {
    return (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value instanceof RegExp ||
      value instanceof Date ||
      (value instanceof Array &&
        this.#getTypeOfArray(value) !== ArrayType.ONLY_OBJECT_EXCLUDING_ARRAY)
    );
  }
  #header(keys) {
    return `[${joinKeys(keys)}]`;
  }
  #headerGroup(keys) {
    return `[[${joinKeys(keys)}]]`;
  }
  #declaration(keys) {
    const title = joinKeys(keys);
    if (title.length > this.maxPad) {
      this.maxPad = title.length;
    }
    return `${title} = `;
  }
  #arrayDeclaration(keys, value) {
    return `${this.#declaration(keys)}${JSON.stringify(value)}`;
  }
  #strDeclaration(keys, value) {
    return `${this.#declaration(keys)}${JSON.stringify(value)}`;
  }
  #numberDeclaration(keys, value) {
    switch (value) {
      case Infinity:
        return `${this.#declaration(keys)}inf`;
      case -Infinity:
        return `${this.#declaration(keys)}-inf`;
      default:
        return `${this.#declaration(keys)}${value}`;
    }
  }
  #boolDeclaration(keys, value) {
    return `${this.#declaration(keys)}${value}`;
  }
  #printDate(value) {
    function dtPad(v, lPad = 2) {
      return v.padStart(lPad, "0");
    }
    const m = dtPad((value.getUTCMonth() + 1).toString());
    const d = dtPad(value.getUTCDate().toString());
    const h = dtPad(value.getUTCHours().toString());
    const min = dtPad(value.getUTCMinutes().toString());
    const s = dtPad(value.getUTCSeconds().toString());
    const ms = dtPad(value.getUTCMilliseconds().toString(), 3);
    // formatted date
    const fData = `${value.getUTCFullYear()}-${m}-${d}T${h}:${min}:${s}.${ms}`;
    return fData;
  }
  #dateDeclaration(keys, value) {
    return `${this.#declaration(keys)}${this.#printDate(value)}`;
  }
  #format(options = {}) {
    const { keyAlignment = false } = options;
    const rDeclaration = /^(\".*\"|[^=]*)\s=/;
    const out = [];
    for (let i = 0; i < this.output.length; i++) {
      const l = this.output[i];
      // we keep empty entry for array of objects
      if (l[0] === "[" && l[1] !== "[") {
        // empty object
        if (this.output[i + 1] === "") {
          i += 1;
          continue;
        }
        out.push(l);
      } else {
        if (keyAlignment) {
          const m = rDeclaration.exec(l);
          if (m) {
            out.push(l.replace(m[1], m[1].padEnd(this.maxPad)));
          } else {
            out.push(l);
          }
        } else {
          out.push(l);
        }
      }
    }
    // Cleaning multiple spaces
    const cleanedOutput = [];
    for (let i = 0; i < out.length; i++) {
      const l = out[i];
      if (!(l === "" && out[i + 1] === "")) {
        cleanedOutput.push(l);
      }
    }
    return cleanedOutput;
  }
}
/**
 * Stringify dumps source object into TOML string and returns it.
 * @param srcObj
 * @param [fmtOptions] format options
 * @param [fmtOptions.keyAlignment] whether to algin key
 */
export function stringify(srcObj, fmtOptions) {
  return new Dumper(srcObj).dump(fmtOptions).join("\n");
}
