// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
import { BytesList } from "../bytes/bytes_list";
import { createLPS } from "./_common";
/** Transform a stream into a stream where each chunk is divided by a given delimiter.
 *
 * ```ts
 * import { DelimiterStream } from "https://deno.land/std@$STD_VERSION/streams/delimiter_stream";
 * const res = await fetch("https://example.com");
 * const parts = res.body!
 *   .pipeThrough(new DelimiterStream(new TextEncoder().encode("foo")))
 *   .pipeThrough(new TextDecoderStream());
 * ```
 */
export class DelimiterStream extends TransformStream {
  #bufs = new BytesList();
  #delimiter;
  #inspectIndex = 0;
  #matchIndex = 0;
  #delimLen;
  #delimLPS;
  constructor(delimiter) {
    super({
      transform: (chunk, controller) => {
        this.#handle(chunk, controller);
      },
      flush: (controller) => {
        controller.enqueue(this.#bufs.concat());
      },
    });
    this.#delimiter = delimiter;
    this.#delimLen = delimiter.length;
    this.#delimLPS = createLPS(delimiter);
  }
  #handle(chunk, controller) {
    this.#bufs.add(chunk);
    let localIndex = 0;
    while (this.#inspectIndex < this.#bufs.size()) {
      if (chunk[localIndex] === this.#delimiter[this.#matchIndex]) {
        this.#inspectIndex++;
        localIndex++;
        this.#matchIndex++;
        if (this.#matchIndex === this.#delimLen) {
          // Full match
          const matchEnd = this.#inspectIndex - this.#delimLen;
          const readyBytes = this.#bufs.slice(0, matchEnd);
          controller.enqueue(readyBytes);
          // Reset match, different from KMP.
          this.#bufs.shift(this.#inspectIndex);
          this.#inspectIndex = 0;
          this.#matchIndex = 0;
        }
      } else {
        if (this.#matchIndex === 0) {
          this.#inspectIndex++;
          localIndex++;
        } else {
          this.#matchIndex = this.#delimLPS[this.#matchIndex - 1];
        }
      }
    }
  }
}
