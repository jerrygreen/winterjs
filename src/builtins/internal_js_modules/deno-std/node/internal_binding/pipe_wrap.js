// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.
var _a;
// This module ports:
// - https://github.com/nodejs/node/blob/master/src/pipe_wrap.cc
// - https://github.com/nodejs/node/blob/master/src/pipe_wrap.h
import { notImplemented } from "../_utils";
import { unreachable } from "../../_util/asserts";
import { ConnectionWrap } from "./connection_wrap";
import { AsyncWrap, providerType } from "./async_wrap";
import { LibuvStreamWrap } from "./stream_wrap";
import { codeMap } from "./uv";
import { delay } from "../../async/mod";
import { kStreamBaseField } from "./stream_wrap";
import {
  ceilPowOf2,
  INITIAL_ACCEPT_BACKOFF_DELAY,
  MAX_ACCEPT_BACKOFF_DELAY,
} from "./_listen";
import { isWindows } from "../../_util/os";
import { fs } from "./constants";
export var socketType;
(function (socketType) {
  socketType[(socketType["SOCKET"] = 0)] = "SOCKET";
  socketType[(socketType["SERVER"] = 1)] = "SERVER";
  socketType[(socketType["IPC"] = 2)] = "IPC";
})(socketType || (socketType = {}));
export class Pipe extends ConnectionWrap {
  reading = false;
  ipc;
  // REF: https://github.com/nodejs/node/blob/master/deps/uv/src/win/pipe.c#L48
  #pendingInstances = 4;
  #address;
  #backlog;
  #listener;
  #connections = 0;
  #closed = false;
  #acceptBackoffDelay;
  constructor(type, conn) {
    let provider;
    let ipc;
    switch (type) {
      case socketType.SOCKET: {
        provider = providerType.PIPEWRAP;
        ipc = false;
        break;
      }
      case socketType.SERVER: {
        provider = providerType.PIPESERVERWRAP;
        ipc = false;
        break;
      }
      case socketType.IPC: {
        provider = providerType.PIPEWRAP;
        ipc = true;
        break;
      }
      default: {
        unreachable();
      }
    }
    super(provider, conn);
    this.ipc = ipc;
    if (conn && provider === providerType.PIPEWRAP) {
      const localAddr = conn.localAddr;
      this.#address = localAddr.path;
    }
  }
  open(_fd) {
    // REF: https://github.com/denoland/deno/issues/6529
    notImplemented("Pipe.prototype.open");
  }
  /**
   * Bind to a Unix domain or Windows named pipe.
   * @param name Unix domain or Windows named pipe the server should listen to.
   * @return An error status code.
   */
  bind(name) {
    // Deno doesn't currently separate bind from connect. For now we noop under
    // the assumption we will connect shortly.
    // REF: https://doc.deno.land/deno/unstable/~/Deno.connect
    this.#address = name;
    return 0;
  }
  /**
   * Connect to a Unix domain or Windows named pipe.
   * @param req A PipeConnectWrap instance.
   * @param address Unix domain or Windows named pipe the server should connect to.
   * @return An error status code.
   */
  connect(req, address) {
    if (isWindows) {
      // REF: https://github.com/denoland/deno/issues/10244
      notImplemented("Pipe.prototype.connect - Windows");
    }
    const connectOptions = {
      path: address,
      transport: "unix",
    };
    Deno.connect(connectOptions).then(
      (conn) => {
        const localAddr = conn.localAddr;
        this.#address = req.address = localAddr.path;
        this[kStreamBaseField] = conn;
        try {
          this.afterConnect(req, 0);
        } catch {
          // swallow callback errors.
        }
      },
      (e) => {
        // TODO(cmorten): correct mapping of connection error to status code.
        let code;
        if (e instanceof Deno.errors.NotFound) {
          code = codeMap.get("ENOENT");
        } else if (e instanceof Deno.errors.PermissionDenied) {
          code = codeMap.get("EACCES");
        } else {
          code = codeMap.get("ECONNREFUSED");
        }
        try {
          this.afterConnect(req, code);
        } catch {
          // swallow callback errors.
        }
      }
    );
    return 0;
  }
  /**
   * Listen for new connections.
   * @param backlog The maximum length of the queue of pending connections.
   * @return An error status code.
   */
  listen(backlog) {
    if (isWindows) {
      // REF: https://github.com/denoland/deno/issues/10244
      notImplemented("Pipe.prototype.listen - Windows");
    }
    this.#backlog = isWindows
      ? this.#pendingInstances
      : ceilPowOf2(backlog + 1);
    const listenOptions = {
      path: this.#address,
      transport: "unix",
    };
    let listener;
    try {
      listener = Deno.listen(listenOptions);
    } catch (e) {
      if (e instanceof Deno.errors.AddrInUse) {
        return codeMap.get("EADDRINUSE");
      } else if (e instanceof Deno.errors.AddrNotAvailable) {
        return codeMap.get("EADDRNOTAVAIL");
      } else if (e instanceof Deno.errors.PermissionDenied) {
        throw e;
      }
      // TODO(cmorten): map errors to appropriate error codes.
      return codeMap.get("UNKNOWN");
    }
    const address = listener.addr;
    this.#address = address.path;
    this.#listener = listener;
    this.#accept();
    return 0;
  }
  ref() {
    if (this.#listener) {
      this.#listener.ref();
    }
  }
  unref() {
    if (this.#listener) {
      this.#listener.unref();
    }
  }
  /**
   * Set the number of pending pipe instance handles when the pipe server is
   * waiting for connections. This setting applies to Windows only.
   * @param instances Number of pending pipe instances.
   */
  setPendingInstances(instances) {
    this.#pendingInstances = instances;
  }
  /**
   * Alters pipe permissions, allowing it to be accessed from processes run by
   * different users. Makes the pipe writable or readable by all users. Mode
   * can be `UV_WRITABLE`, `UV_READABLE` or `UV_WRITABLE | UV_READABLE`. This
   * function is blocking.
   * @param mode Pipe permissions mode.
   * @return An error status code.
   */
  fchmod(mode) {
    if (
      mode != constants.UV_READABLE &&
      mode != constants.UV_WRITABLE &&
      mode != (constants.UV_WRITABLE | constants.UV_READABLE)
    ) {
      return codeMap.get("EINVAL");
    }
    let desired_mode = 0;
    if (mode & constants.UV_READABLE) {
      desired_mode |= fs.S_IRUSR | fs.S_IRGRP | fs.S_IROTH;
    }
    if (mode & constants.UV_WRITABLE) {
      desired_mode |= fs.S_IWUSR | fs.S_IWGRP | fs.S_IWOTH;
    }
    // TODO(cmorten): this will incorrectly throw on Windows
    // REF: https://github.com/denoland/deno/issues/4357
    try {
      Deno.chmodSync(this.#address, desired_mode);
    } catch {
      // TODO(cmorten): map errors to appropriate error codes.
      return codeMap.get("UNKNOWN");
    }
    return 0;
  }
  /** Handle backoff delays following an unsuccessful accept. */
  async #acceptBackoff() {
    // Backoff after transient errors to allow time for the system to
    // recover, and avoid blocking up the event loop with a continuously
    // running loop.
    if (!this.#acceptBackoffDelay) {
      this.#acceptBackoffDelay = INITIAL_ACCEPT_BACKOFF_DELAY;
    } else {
      this.#acceptBackoffDelay *= 2;
    }
    if (this.#acceptBackoffDelay >= MAX_ACCEPT_BACKOFF_DELAY) {
      this.#acceptBackoffDelay = MAX_ACCEPT_BACKOFF_DELAY;
    }
    await delay(this.#acceptBackoffDelay);
    this.#accept();
  }
  /** Accept new connections. */
  async #accept() {
    if (this.#closed) {
      return;
    }
    if (this.#connections > this.#backlog) {
      this.#acceptBackoff();
      return;
    }
    let connection;
    try {
      connection = await this.#listener.accept();
    } catch (e) {
      if (e instanceof Deno.errors.BadResource && this.#closed) {
        // Listener and server has closed.
        return;
      }
      try {
        // TODO(cmorten): map errors to appropriate error codes.
        this.onconnection(codeMap.get("UNKNOWN"), undefined);
      } catch {
        // swallow callback errors.
      }
      this.#acceptBackoff();
      return;
    }
    // Reset the backoff delay upon successful accept.
    this.#acceptBackoffDelay = undefined;
    const connectionHandle = new _a(socketType.SOCKET, connection);
    this.#connections++;
    try {
      this.onconnection(0, connectionHandle);
    } catch {
      // swallow callback errors.
    }
    return this.#accept();
  }
  /** Handle server closure. */
  _onClose() {
    this.#closed = true;
    this.reading = false;
    this.#address = undefined;
    this.#backlog = undefined;
    this.#connections = 0;
    this.#acceptBackoffDelay = undefined;
    if (this.provider === providerType.PIPESERVERWRAP) {
      try {
        this.#listener.close();
      } catch {
        // listener already closed
      }
    }
    return LibuvStreamWrap.prototype._onClose.call(this);
  }
}
_a = Pipe;
export class PipeConnectWrap extends AsyncWrap {
  oncomplete;
  address;
  constructor() {
    super(providerType.PIPECONNECTWRAP);
  }
}
export var constants;
(function (constants) {
  constants[(constants["SOCKET"] = 0)] = "SOCKET";
  constants[(constants["SERVER"] = 1)] = "SERVER";
  constants[(constants["IPC"] = 2)] = "IPC";
  constants[(constants["UV_READABLE"] = 1)] = "UV_READABLE";
  constants[(constants["UV_WRITABLE"] = 2)] = "UV_WRITABLE";
})(constants || (constants = {}));
