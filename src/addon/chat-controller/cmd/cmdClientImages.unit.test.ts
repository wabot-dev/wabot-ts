import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { imageFromPath, imageMimeForPath, parseDroppedPath } from './cmdClientImages'

test.describe('imageMimeForPath', () => {
  test('maps known image extensions, case-insensitively', () => {
    assert.equal(imageMimeForPath('/a/b.png'), 'image/png')
    assert.equal(imageMimeForPath('/a/b.JPG'), 'image/jpeg')
    assert.equal(imageMimeForPath('shot.jpeg'), 'image/jpeg')
    assert.equal(imageMimeForPath('x.webp'), 'image/webp')
  })

  test('returns null for non-image or extensionless paths', () => {
    assert.equal(imageMimeForPath('/a/b.txt'), null)
    assert.equal(imageMimeForPath('/a/b'), null)
  })
})

test.describe('parseDroppedPath', () => {
  test('strips surrounding single and double quotes', () => {
    assert.equal(parseDroppedPath(`'/a/b c.png'`), '/a/b c.png')
    assert.equal(parseDroppedPath('"/a/b.png"'), '/a/b.png')
  })

  test('unescapes backslash-escaped characters on unquoted paths', () => {
    assert.equal(parseDroppedPath('/a/b\\ c.png'), '/a/b c.png')
  })

  test('leaves a plain path untouched', () => {
    assert.equal(parseDroppedPath('  /a/b.png  '), '/a/b.png')
  })
})

test.describe('imageFromPath', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wabot-img-'))
  test.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }))

  test('reads an image file into a data-url wire image', () => {
    const file = path.join(tmpDir, 'pic.png')
    fs.writeFileSync(file, Buffer.from([1, 2, 3]))

    const image = imageFromPath(file)
    assert.deepEqual(image, {
      name: 'pic.png',
      mimeType: 'image/png',
      base64Url: 'data:image/png;base64,AQID',
    })
  })

  test('handles a drag-and-drop escaped path with spaces', () => {
    const file = path.join(tmpDir, 'my shot.jpg')
    fs.writeFileSync(file, Buffer.from([0]))

    const image = imageFromPath(file.replace(/ /g, '\\ '))
    assert.equal(image?.name, 'my shot.jpg')
    assert.equal(image?.mimeType, 'image/jpeg')
  })

  test('returns null for a non-image extension', () => {
    const file = path.join(tmpDir, 'note.txt')
    fs.writeFileSync(file, 'hi')
    assert.equal(imageFromPath(file), null)
  })

  test('returns null for a missing file or a directory', () => {
    assert.equal(imageFromPath(path.join(tmpDir, 'nope.png')), null)
    assert.equal(imageFromPath(tmpDir), null)
  })
})
