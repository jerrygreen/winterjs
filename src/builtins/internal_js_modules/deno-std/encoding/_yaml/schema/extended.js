// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
import { Schema } from "../schema";
import { regexp, undefinedType } from "../type/mod";
import { def } from "./default";
/***
 * Extends JS-YAML default schema with additional JavaScript types
 * It is not described in the YAML specification.
 * Functions are no longer supported for security reasons.
 *
 * @example
 * ```ts
 * import {
 *   EXTENDED_SCHEMA,
 *   parse,
 * } from "https://deno.land/std@$STD_VERSION/encoding/yaml";
 *
 * const data = parse(
 *   `
 *   regexp:
 *     simple: !!js/regexp foobar
 *     modifiers: !!js/regexp /foobar/mi
 *   undefined: !!js/undefined ~
 * # Disabled, see: https://github.com/denoland/deno_std/pull/1275
 * #  function: !!js/function >
 * #    function foobar() {
 * #      return 'hello world!';
 * #    }
 * `,
 *   { schema: EXTENDED_SCHEMA },
 * );
 * ```
 */
export const extended = new Schema({
  explicit: [regexp, undefinedType],
  include: [def],
});
