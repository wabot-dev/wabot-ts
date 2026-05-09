import { ConfigReference } from './types'

function parsePathAndDefault(strings: TemplateStringsArray): [string, string | undefined] {
  if (strings.length > 1) {
    throw new Error(
      'Config tag templates do not support interpolation. Use a literal path like str`my.path:default`.',
    )
  }
  const template = strings[0]
  const idx = template.indexOf(':')
  if (idx === -1) return [template.trim(), undefined]
  const path = template.slice(0, idx).trim()
  const defaultValue = template.slice(idx + 1).trim()
  return [path, defaultValue]
}

function createConfigReference(
  type: ConfigReference['type'],
  strings: TemplateStringsArray,
): ConfigReference {
  const [path, defaultValue] = parsePathAndDefault(strings)
  return {
    type,
    path,
    default: defaultValue,
    __isConfigReference: true,
  }
}

export function str(strings: TemplateStringsArray): ConfigReference {
  return createConfigReference('string', strings)
}

export function num(strings: TemplateStringsArray): ConfigReference {
  return createConfigReference('number', strings)
}

export function bool(strings: TemplateStringsArray): ConfigReference {
  return createConfigReference('boolean', strings)
}

export function obj(strings: TemplateStringsArray): ConfigReference {
  return createConfigReference('object', strings)
}

export function strArr(strings: TemplateStringsArray): ConfigReference {
  return createConfigReference('string-array', strings)
}

export function numArr(strings: TemplateStringsArray): ConfigReference {
  return createConfigReference('number-array', strings)
}

export function boolArr(strings: TemplateStringsArray): ConfigReference {
  return createConfigReference('boolean-array', strings)
}
