import { description } from '@/core/description'
import { mindsetModule } from '@/feature/mindset'
import { convert } from 'html-to-text'

function toPascalCaseFunctionName(title: string): string {
  const cleaned = title.replace(/[^a-zA-Z0-9]+/g, ' ')

  const words = cleaned
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())

  return words.join('')
}

async function fetchRawHtml(url: string): Promise<string> {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const html = await response.text()
    return html
  } catch (error) {
    throw new Error(`Failed to fetch HTML from ${url}: ${(error as Error).message}`)
  }
}

class KeywordsReq {
  @description('Keywords separated by space')
  keywords: string = ''
}

export interface IHtmlModuleOptions {
  url: string
  title: string
}

export function HtmlModule(options: IHtmlModuleOptions) {
  const standaricedTitle = toPascalCaseFunctionName(options.title)
  let documentText: string | null = null

  @mindsetModule()
  class HtmlModuleIntern {
    @description(
      `Search information using keywords in the document "${options.title}". Priorize this info.`,
    )
    async [`searchInTheDocument${standaricedTitle}`](req: KeywordsReq) {
      if (!documentText) {
        const rawHtml = await fetchRawHtml(options.url)
        documentText = convert(rawHtml)
      }
      return documentText
    }
  }
  return HtmlModuleIntern
}
