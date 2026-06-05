import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { ICmdImage } from './cmdWireProtocol'

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.bmp': 'image/bmp',
}

/** Image mime type for a file path based on its extension, or null if not an image. */
export function imageMimeForPath(filePath: string): string | null {
  return IMAGE_MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? null
}

/**
 * Normalizes a path as a terminal hands it over on drag-and-drop or paste:
 * strips surrounding single/double quotes and unescapes backslash-escaped
 * characters (e.g. `\ ` for spaces).
 */
export function parseDroppedPath(input: string): string {
  let value = input.trim()
  if (
    value.length >= 2 &&
    ((value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"')))
  ) {
    value = value.slice(1, -1)
  } else {
    value = value.replace(/\\(.)/g, '$1')
  }
  return value
}

/** Reads an image file into a wire image, or returns null if it is not a readable image file. */
export function imageFromPath(rawPath: string): ICmdImage | null {
  const filePath = parseDroppedPath(rawPath)
  const mimeType = imageMimeForPath(filePath)
  if (!mimeType) return null
  try {
    if (!fs.statSync(filePath).isFile()) return null
    const base64 = fs.readFileSync(filePath).toString('base64')
    return {
      name: path.basename(filePath),
      mimeType,
      base64Url: `data:${mimeType};base64,${base64}`,
    }
  } catch {
    return null
  }
}

/**
 * Reads an image from the system clipboard, cross-platform. Returns null when
 * the clipboard holds no image or the platform tool is unavailable.
 *
 * - macOS: `osascript` (built in)
 * - Linux: `wl-paste` (Wayland) then `xclip` (X11)
 * - Windows: PowerShell `System.Windows.Forms.Clipboard`
 */
export function readClipboardImage(): ICmdImage | null {
  const tmpFile = path.join(os.tmpdir(), `wabot-clip-${process.pid}-${Date.now()}.png`)
  try {
    if (!dumpClipboardImage(tmpFile)) return null
    const stat = fs.statSync(tmpFile)
    if (!stat.isFile() || stat.size === 0) return null
    const base64 = fs.readFileSync(tmpFile).toString('base64')
    return {
      name: 'clipboard.png',
      mimeType: 'image/png',
      base64Url: `data:image/png;base64,${base64}`,
    }
  } catch {
    return null
  } finally {
    try {
      fs.unlinkSync(tmpFile)
    } catch {
      // ignore: file may not have been created
    }
  }
}

function dumpClipboardImage(outFile: string): boolean {
  switch (process.platform) {
    case 'darwin': {
      const script = [
        `set theFile to (open for access (POSIX file ${JSON.stringify(outFile)}) with write permission)`,
        'try',
        '  set eof theFile to 0',
        '  write (the clipboard as «class PNGf») to theFile',
        '  close access theFile',
        'on error',
        '  close access theFile',
        '  error "no image on clipboard"',
        'end try',
      ].join('\n')
      return run('osascript', ['-e', script])
    }
    case 'linux': {
      const quoted = `'${outFile.replace(/'/g, `'\\''`)}'`
      return (
        run('sh', ['-c', `wl-paste --type image/png > ${quoted}`]) ||
        run('sh', ['-c', `xclip -selection clipboard -t image/png -o > ${quoted}`])
      )
    }
    case 'win32': {
      const ps =
        'Add-Type -AssemblyName System.Windows.Forms;' +
        '$img=[Windows.Forms.Clipboard]::GetImage();' +
        `if($img -ne $null){$img.Save(${JSON.stringify(outFile)});exit 0}else{exit 1}`
      return run('powershell', ['-NoProfile', '-Command', ps])
    }
    default:
      return false
  }
}

function run(command: string, args: string[]): boolean {
  try {
    return spawnSync(command, args, { stdio: ['ignore', 'ignore', 'ignore'] }).status === 0
  } catch {
    return false
  }
}
