import type { RawData } from 'ws'

/**
 * Converts WebSocket RawData to string safely
 * @param message - The RawData from WebSocket
 * @returns String representation of the message
 */
export function rawDataToString (message: RawData): string {
  if (message instanceof Buffer) {
    return message.toString()
  }
  if (Array.isArray(message)) {
    return Buffer.concat(message).toString()
  }
  return new TextDecoder().decode(message as ArrayBuffer)
}
