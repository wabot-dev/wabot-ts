const PH_OPEN = ''
const PH_CLOSE = ''

function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function markdownToSlackMrkdwn(input: string): string {
  if (!input) return input

  const reserved: string[] = []
  const reserve = (snippet: string): string => {
    const token = `${PH_OPEN}${reserved.length}${PH_CLOSE}`
    reserved.push(snippet)
    return token
  }

  let text = input.replace(/\r\n/g, '\n')

  text = text.replace(/```[\s\S]*?```/g, (block) => {
    return reserve(block)
  })

  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    return reserve('`' + code + '`')
  })

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    return reserve(`<${url}|${label}>`)
  })

  text = escapeMrkdwn(text)

  text = text.replace(/^(#{1,6})\s+(.+)$/gm, (_, _hashes, content) => `*${content.trim()}*`)

  text = text.replace(/^&gt;\s?(.*)$/gm, '> $1')
  text = text.replace(/^>\s*$\n/gm, '')

  text = text.replace(/\*\*([^\n*]+?)\*\*/g, '*$1*')
  text = text.replace(/(^|[\s(>])__([^\n*][^_\n]*?)__(?=[\s).,!?:;]|$)/g, '$1*$2*')

  text = text.replace(/(^|[\s(>])_([^\s_][^_\n]*?)_(?=[\s).,!?:;]|$)/g, '$1_$2_')

  text = text.replace(/~~([^\n~]+?)~~/g, '~$1~')

  text = text.replace(/^[ \t]*[-*+]\s+(.+)$/gm, '• $1')

  text = text.replace(
    new RegExp(`${PH_OPEN}(\\d+)${PH_CLOSE}`, 'g'),
    (_, idx) => reserved[Number(idx)],
  )

  return text
}
