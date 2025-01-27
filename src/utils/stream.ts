import type { Readable as NodeReadableType } from 'stream'
import { isStrictlyObject } from './type'
import { ReadableStream } from 'web-streams-polyfill/ponyfill'
import { Readable as NodeReadable, ReadableOptions as NodeReadableOptions } from 'readable-stream'

import { Readable } from '../types'

/**
 * Validates if passed object is either browser's ReadableStream
 * or Node's Readable.
 *
 * @param entry
 */
export function isReadable(entry: unknown): entry is NodeReadableType {
  return isReadableStream(entry) || isNodeReadable(entry)
}

export function isReadableStream(entry: unknown): entry is ReadableStream {
  if (!isStrictlyObject(entry)) {
    return false
  }

  const browserReadable = entry as ReadableStream

  if (
    typeof browserReadable.getReader === 'function' &&
    browserReadable.locked !== undefined &&
    typeof browserReadable.cancel === 'function' &&
    typeof browserReadable.pipeTo === 'function' &&
    typeof browserReadable.pipeThrough === 'function'
  ) {
    return true
  }

  return false
}

export function isNodeReadable(entry: unknown): entry is NodeReadableType {
  if (!isStrictlyObject(entry)) {
    return false
  }

  const nodeReadable = entry as NodeReadableType

  if (typeof nodeReadable.pipe === 'function' && nodeReadable.readable && typeof nodeReadable._read === 'function') {
    return true
  }

  return false
}

/**
 * Function that converts Node's Readable into WHATWG ReadableStream
 *
 * Taken over from https://github.com/gwicke/node-web-streams/blob/master/lib/conversions.js
 * Because it uses forked web-streams-polyfill that are outdated.
 *
 * @author https://github.com/gwicke
 * @licence Apache License 2.0 https://github.com/gwicke/node-web-streams/blob/master/LICENSE
 * @param nodeStream
 */
export function readableNodeToWeb(nodeStream: NodeReadableType): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.pause()
      nodeStream.on('data', chunk => {
        if (Buffer.isBuffer(chunk)) {
          controller.enqueue(new Uint8Array(chunk.buffer))
        } else {
          controller.enqueue(chunk)
        }
        nodeStream.pause()
      })
      nodeStream.on('end', () => controller.close())
      nodeStream.on('error', e => controller.error(e))
    },
    pull() {
      nodeStream.resume()
    },
    cancel() {
      nodeStream.pause()
    },
  })
}

/**
 * Taken over from https://github.com/gwicke/node-web-streams/blob/master/lib/conversions.js
 * Because it uses forked web-streams-polyfill that are outdated.
 *
 * @author https://github.com/gwicke
 * @licence Apache License 2.0 https://github.com/gwicke/node-web-streams/blob/master/LICENSE
 */
class NodeReadableWrapper extends NodeReadable {
  private _webStream: ReadableStream
  private _reader: ReadableStreamDefaultReader<any>
  private _reading: boolean
  constructor(webStream: ReadableStream, options?: NodeReadableOptions) {
    super(options)
    this._webStream = webStream
    this._reader = webStream.getReader()
    this._reading = false
  }

  _read() {
    if (this._reading) {
      return
    }
    this._reading = true
    const doRead = () => {
      this._reader.read().then(res => {
        if (res.done) {
          this.push(null)

          return
        }

        if (this.push(res.value)) {
          return doRead()
        } else {
          this._reading = false
        }
      })
    }
    doRead()
  }
}

/**
 * Function that converts WHATWG ReadableStream into Node's Readable
 *
 * Taken over from https://github.com/gwicke/node-web-streams/blob/master/lib/conversions.js
 * Because it uses forked web-streams-polyfill that are outdated.
 *
 * @author https://github.com/gwicke
 * @licence Apache License 2.0 https://github.com/gwicke/node-web-streams/blob/master/LICENSE
 * @param webStream
 */
export function readableWebToNode(webStream: ReadableStream, options?: NodeReadableOptions): NodeReadableType {
  return new NodeReadableWrapper(webStream, options) as unknown as NodeReadableType
}

export function normalizeToReadableStream(stream: Readable): ReadableStream {
  if (isNodeReadable(stream)) {
    return readableNodeToWeb(stream)
  } else if (isReadableStream(stream)) {
    return stream
  }

  throw new TypeError('Passed stream is not Node Readable nor ReadableStream!')
}
