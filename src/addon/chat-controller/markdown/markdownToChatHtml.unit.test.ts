import test from 'node:test'
import assert from 'node:assert/strict'
import { markdownToChatHtml } from './markdownToChatHtml'

test.describe('markdownToChatHtml', () => {
  test('converts bold', () => {
    assert.equal(markdownToChatHtml('hello **world**'), 'hello <b>world</b>')
    assert.equal(markdownToChatHtml('__strong__'), '<b>strong</b>')
  })

  test('converts italic with * and _', () => {
    assert.equal(markdownToChatHtml('an *italic* word'), 'an <i>italic</i> word')
    assert.equal(markdownToChatHtml('an _italic_ word'), 'an <i>italic</i> word')
  })

  test('does not match italic inside words', () => {
    assert.equal(markdownToChatHtml('snake_case_var'), 'snake_case_var')
  })

  test('converts strikethrough', () => {
    assert.equal(markdownToChatHtml('~~gone~~'), '<s>gone</s>')
  })

  test('converts inline code and escapes inside', () => {
    assert.equal(
      markdownToChatHtml('use `a < b && c > d`'),
      'use <code>a &lt; b &amp;&amp; c &gt; d</code>',
    )
  })

  test('converts fenced code blocks with language', () => {
    const input = '```ts\nconst x = 1\n```'
    assert.equal(
      markdownToChatHtml(input),
      '<pre><code class="language-ts">const x = 1</code></pre>',
    )
  })

  test('converts fenced code blocks without language', () => {
    const input = '```\nplain code\n```'
    assert.equal(markdownToChatHtml(input), '<pre>plain code</pre>')
  })

  test('does not transform markdown inside code blocks', () => {
    const input = '```\n**not bold** _not italic_\n```'
    assert.equal(markdownToChatHtml(input), '<pre>**not bold** _not italic_</pre>')
  })

  test('converts links', () => {
    assert.equal(
      markdownToChatHtml('see [docs](https://example.com)'),
      'see <a href="https://example.com">docs</a>',
    )
  })

  test('converts unordered list to bullets', () => {
    const input = '- one\n- two\n* three'
    assert.equal(markdownToChatHtml(input), '• one\n• two\n• three')
  })

  test('keeps ordered list as plain text', () => {
    const input = '1. one\n2. two'
    assert.equal(markdownToChatHtml(input), '1. one\n2. two')
  })

  test('converts headings to bold', () => {
    assert.equal(markdownToChatHtml('# Title'), '<b>Title</b>')
    assert.equal(markdownToChatHtml('### Sub'), '<b>Sub</b>')
  })

  test('converts blockquote', () => {
    assert.equal(markdownToChatHtml('> quoted'), '<blockquote>quoted</blockquote>')
  })

  test('merges consecutive blockquote lines', () => {
    assert.equal(
      markdownToChatHtml('> line a\n> line b'),
      '<blockquote>line a\nline b</blockquote>',
    )
  })

  test('escapes html special chars in plain text', () => {
    assert.equal(markdownToChatHtml('a < b & c > d'), 'a &lt; b &amp; c &gt; d')
  })

  test('handles mixed content', () => {
    const input = '**Title**\n- item with *emphasis*\n- item with `code`'
    assert.equal(
      markdownToChatHtml(input),
      '<b>Title</b>\n• item with <i>emphasis</i>\n• item with <code>code</code>',
    )
  })
})