import { escapeAttr } from './escape'

// The context belongs to the *parent* of a suspended subtree. It must survive
// retries: looking at the first resolved child cannot recover HTML insertion mode.
export type InsertionContext = 'html' | 'svg' | 'math' | 'table' | 'tbody' | 'tr' | 'colgroup'

export function childInsertionContext(tag: string, props: Record<string, any>, parent: InsertionContext): InsertionContext {
  if (tag === 'svg') return 'svg'
  if (tag === 'math') return 'math'
  if (tag === 'foreignObject' || (tag === 'annotation-xml' && /^(text\/html|application\/xhtml\+xml)$/i.test(props.encoding ?? ''))) return 'html'
  if (parent === 'svg' || parent === 'math') return parent
  if (tag === 'table' || tag === 'tr' || tag === 'colgroup') return tag
  if (tag === 'tbody' || tag === 'thead' || tag === 'tfoot') return 'tbody'
  return 'html'
}

export function segmentHtml(content: string, id: string, context: InsertionContext): string {
  const nested = context === 'tbody' || context === 'tr' || context === 'colgroup'
  const tag = context === 'html' ? 'div' : context
  const hidden = nested ? '' : context === 'svg' || context === 'math' ? ' aria-hidden="true" style="display:none"' : ' hidden'
  return `${nested ? '<table hidden>' : ''}<${tag}${hidden} id="${escapeAttr(id)}">${content}</${tag}>${nested ? '</table>' : ''}`
}
