import test from 'node:test'
import assert from 'node:assert/strict'
import { markdownToSlackMrkdwn } from './markdownToSlackMrkdwn'

test.describe('markdownToSlackMrkdwn', () => {
  test('returns empty input unchanged', () => {
    assert.equal(markdownToSlackMrkdwn(''), '')
  })

  test('converts bold to single asterisks', () => {
    assert.equal(markdownToSlackMrkdwn('hello **world**'), 'hello *world*')
  })

  test('converts italic to underscores', () => {
    assert.equal(markdownToSlackMrkdwn('an _italic_ word'), 'an _italic_ word')
  })

  test('does not match italic inside words', () => {
    assert.equal(markdownToSlackMrkdwn('snake_case_var'), 'snake_case_var')
  })

  test('converts strikethrough', () => {
    assert.equal(markdownToSlackMrkdwn('~~gone~~'), '~gone~')
  })

  test('preserves inline code verbatim', () => {
    assert.equal(markdownToSlackMrkdwn('use `a < b && c`'), 'use `a < b && c`')
  })

  test('preserves fenced code blocks verbatim', () => {
    const input = '```ts\nconst x = 1\n```'
    assert.equal(markdownToSlackMrkdwn(input), '```ts\nconst x = 1\n```')
  })

  test('does not transform markdown inside fenced code blocks', () => {
    const input = '```\n**not bold** _not italic_\n```'
    assert.equal(markdownToSlackMrkdwn(input), '```\n**not bold** _not italic_\n```')
  })

  test('converts links to slack <url|label> syntax', () => {
    assert.equal(
      markdownToSlackMrkdwn('see [docs](https://example.com)'),
      'see <https://example.com|docs>',
    )
  })

  test('converts unordered list to bullets', () => {
    const input = '- one\n- two\n* three'
    assert.equal(markdownToSlackMrkdwn(input), '• one\n• two\n• three')
  })

  test('keeps ordered list as plain text', () => {
    const input = '1. one\n2. two'
    assert.equal(markdownToSlackMrkdwn(input), '1. one\n2. two')
  })

  test('converts headings to bold', () => {
    assert.equal(markdownToSlackMrkdwn('# Title'), '*Title*')
    assert.equal(markdownToSlackMrkdwn('### Sub'), '*Sub*')
  })

  test('converts blockquote', () => {
    assert.equal(markdownToSlackMrkdwn('> quoted'), '> quoted')
  })

  test('escapes html special chars in plain text', () => {
    assert.equal(markdownToSlackMrkdwn('a < b & c > d'), 'a &lt; b &amp; c &gt; d')
  })

  test('handles mixed content', () => {
    const input = '**Title**\n- item with _emphasis_\n- item with `code`'
    assert.equal(
      markdownToSlackMrkdwn(input),
      '*Title*\n• item with _emphasis_\n• item with `code`',
    )
  })
})
