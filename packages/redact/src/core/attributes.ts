export const STRING_BOOLEAN_ATTRS = /^(contenteditable|draggable|spellcheck)$/

export function attributeName(name: string, isSvg?: boolean): string {
  if (name === 'className') return 'class'
  if (name === 'htmlFor') return 'for'
  if ((isSvg && /^(clip|fill|stroke)/.test(name)) || /^(httpEquiv|acceptCharset|maskType)$/.test(name)) {
    return name.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
  }
  return name === 'viewBox' || /^(aria|data)-/.test(name) ? name : name.toLowerCase()
}
