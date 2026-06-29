import {
  IChatItem,
  IChatMessage,
  IChatMessageDocument,
  IChatMessageImage,
} from '@/feature/chat-bot'

import { testImageBase64 } from './testImageBase64'

/**
 * A real JPEG photo of a store receipt (total: 11.570), handy for testing
 * vision flows against real models without shipping binary assets.
 */
export const testImageBase64Url = `data:image/jpeg;base64,${testImageBase64}`

/** A minimal one-page PDF whose content is the text "Hello World". */
export const testPdfBase64Url =
  'data:application/pdf;base64,JVBERi0xLjEKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMjAwIDIwMF0vUmVzb3VyY2VzPDwvRm9udDw8L0YxPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj4+Pj4+L0NvbnRlbnRzIDQgMCBSPj5lbmRvYmoKNCAwIG9iajw8L0xlbmd0aCA0ND4+c3RyZWFtCkJUIC9GMSAxMiBUZiA1MCAxMDAgVGQgKEhlbGxvIFdvcmxkKSBUaiBFVAplbmRzdHJlYW0gZW5kb2JqCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDUzIDAwMDAwIG4gCjAwMDAwMDAwOTggMDAwMDAgbiAKMDAwMDAwMDIyOCAwMDAwMCBuIAp0cmFpbGVyPDwvU2l6ZSA1L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMzIwCiUlRU9GCg=='

export function humanMessage(message: string | IChatMessage): IChatMessage {
  return typeof message === 'string' ? { text: message } : message
}

export interface IFileFixtureOptions {
  text?: string
  id?: string
  mimeType?: string
  publicUrl?: string
  base64Url?: string
}

/** Human message carrying an image; defaults to the embedded receipt photo. */
export function imageMessage(options: IFileFixtureOptions = {}): IChatMessage {
  const image: IChatMessageImage = options.publicUrl
    ? {
        id: options.id ?? 'test-image',
        mimeType: options.mimeType ?? 'image/jpeg',
        publicUrl: options.publicUrl,
      }
    : {
        id: options.id ?? 'test-image',
        mimeType: options.mimeType ?? 'image/jpeg',
        base64Url: options.base64Url ?? testImageBase64Url,
      }
  return { text: options.text, images: [image] }
}

/** Human message carrying a document; defaults to the embedded sample PDF. */
export function documentMessage(options: IFileFixtureOptions = {}): IChatMessage {
  const document: IChatMessageDocument = options.publicUrl
    ? {
        id: options.id ?? 'test-document',
        mimeType: options.mimeType ?? 'application/pdf',
        publicUrl: options.publicUrl,
      }
    : {
        id: options.id ?? 'test-document',
        mimeType: options.mimeType ?? 'application/pdf',
        base64Url: options.base64Url ?? testPdfBase64Url,
      }
  return { text: options.text, documents: [document] }
}

export function humanItem(message: string | IChatMessage): IChatItem {
  return { type: 'humanMessage', humanMessage: humanMessage(message) }
}

export function botItem(message: string | IChatMessage): IChatItem {
  return {
    type: 'botMessage',
    botMessage: typeof message === 'string' ? { text: message } : message,
  }
}
