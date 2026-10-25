// React's completed-component track already checks these bounds. Error and
// cancellation tracks in React 19.3.1 omit them and can pass a negative end to
// Performance.measure. Keep the correction in development Flight modules.
// https://github.com/react/react/pull/37572
function walk(node: any, visit: (node: any) => void): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) { for (const item of node) walk(item, visit); return }
  if (typeof node.type !== 'string') return
  visit(node)
  for (const [key, value] of Object.entries(node)) if (key !== 'parent' && value && typeof value === 'object') walk(value, visit)
}
function property(node: any, name: string): any {
  return node?.type === 'ObjectExpression'
    ? node.properties.find((entry: any) => (entry.key?.name ?? entry.key?.value) === name)?.value
    : undefined
}
export function correctFlightTimings(code: string, id: string, parse: (code: string) => any): string | null {
  if (!/(?:^|[/\\])react-server-dom-webpack-client\.(?:browser|edge|node)\.development\.js$/.test(id.split('?')[0]!)) return null
  const edits: { start: number; end: number; text: string }[] = []
  walk(parse(code), node => {
    if (node.type !== 'IfStatement' || node.test.type !== 'Identifier' || node.test.name !== 'supportsUserTiming') return
    walk(node.consequent, call => {
      if (call.type !== 'CallExpression' || call.callee.type !== 'MemberExpression' ||
          call.callee.object.name !== 'performance' || call.callee.property.name !== 'measure') return
      const options = call.arguments[1]
      const end = property(options, 'end')
      const track = property(property(property(options, 'detail'), 'devtools'), 'track')
      if (end?.type !== 'Identifier' || !/^childrenEndTime(?:\$jscomp\$\d+)?$/.test(end.name) ||
          track?.type !== 'MemberExpression' || track.object.name !== 'trackNames' ||
          track.property.type !== 'Identifier' || !/^trackIdx(?:\$jscomp\$\d+)?$/.test(track.property.name)) return
      edits.push({ start: node.test.start, end: node.test.end, text: `supportsUserTiming && ${end.name} >= 0 && ${track.property.name} < 10` })
    })
  })
  if (!edits.length) return null
  for (const edit of edits.sort((a, b) => b.start - a.start)) code = code.slice(0, edit.start) + edit.text + code.slice(edit.end)
  return code
}
