const PH_OPEN = '\x01'
const PH_CLOSE = '\x02'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function markdownToChatHtml(input: string): string {
  if (!input) return input

  const reserved: string[] = []
  const reserve = (html: string): string => {
    const token = `${PH_OPEN}${reserved.length}${PH_CLOSE}`
    reserved.push(html)
    return token
  }

  let text = input.replace(/\r\n/g, '\n')

  text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = escapeHtml(code.replace(/\n$/, ''))
    if (lang) return reserve(`<pre><code class="language-${lang}">${escaped}</code></pre>`)
    return reserve(`<pre>${escaped}</pre>`)
  })

  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    return reserve(`<code>${escapeHtml(code)}</code>`)
  })

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    return reserve(`<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`)
  })

  text = escapeHtml(text)

  text = text.replace(/^(#{1,6})\s+(.+)$/gm, (_, _hashes, content) => `<b>${content.trim()}</b>`)

  text = text.replace(/^&gt;\s?(.*)$/gm, '<blockquote>$1</blockquote>')
  text = text.replace(/<\/blockquote>\n<blockquote>/g, '\n')

  text = text.replace(/\*\*([^\n*]+?)\*\*/g, '<b>$1</b>')
  text = text.replace(/__([^\n_]+?)__/g, '<b>$1</b>')

  text = text.replace(/(^|[\s(>])\*([^\s*][^*\n]*?)\*(?=[\s).,!?:;]|$)/g, '$1<i>$2</i>')
  text = text.replace(/(^|[\s(>])_([^\s_][^_\n]*?)_(?=[\s).,!?:;]|$)/g, '$1<i>$2</i>')

  text = text.replace(/~~([^\n~]+?)~~/g, '<s>$1</s>')

  text = text.replace(/^[ \t]*[-*+]\s+(.+)$/gm, '• $1')

  text = text.replace(new RegExp(`${PH_OPEN}(\\d+)${PH_CLOSE}`, 'g'), (_, idx) =>
    reserved[Number(idx)],
  )

  return text
}
