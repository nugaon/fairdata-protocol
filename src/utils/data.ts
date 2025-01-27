import type { Data } from 'ws'
import Blob from 'cross-blob'
import { isNodeReadable, isReadableStream, readableWebToNode } from './stream'
import { Readable } from '../types'

/**
 * Prepare data for valid input for node-fetch.
 *
 * node-fetch is not using WHATWG ReadableStream but NodeJS Readable so we need to convert in case of ReadableStream,
 * but the typings are set to use ReadableStream so hence why type conversion here.
 *
 * @param data any string, ArrayBuffer, Uint8Array or Readable
 */
export async function prepareData(
  data: string | ArrayBuffer | Uint8Array | Readable,
): Promise<Blob | ReadableStream<Uint8Array> | never> {
  if (typeof data === 'string') return new Blob([data], { type: 'text/plain' })

  if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
    return new Blob([data], { type: 'application/octet-stream' })
  }

  if (data instanceof Blob || isNodeReadable(data)) return data as ReadableStream<Uint8Array>

  if (isReadableStream(data)) {
    return readableWebToNode(data) as unknown as ReadableStream<Uint8Array>
  }

  throw new TypeError('unknown data type')
}

function isBufferArray(buffer: unknown): buffer is Buffer[] {
  return Array.isArray(buffer) && buffer.length > 0 && buffer.every(data => data instanceof Buffer)
}

export async function prepareWebsocketData(data: Data | Blob): Promise<Uint8Array> | never {
  if (typeof data === 'string') return new TextEncoder().encode(data)

  if (data instanceof Buffer) return new Uint8Array(data)

  if (data instanceof ArrayBuffer) return new Uint8Array(data)

  if (data instanceof Blob) return new Uint8Array(await new Response(data as Blob).arrayBuffer())

  if (isBufferArray(data)) return new Uint8Array(Buffer.concat(data))

  throw new TypeError('unknown websocket data type')
}
