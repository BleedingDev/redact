// Turbopack applies Next's built-in React aliases after user aliases. Replace
// the resolved browser entry through its supported loader API instead.
const { relative, dirname, sep } = require('node:path')

module.exports = function redactEntry() {
  const { target, defaultExport } = this.getOptions()
  const path = relative(dirname(this.resourcePath), target).split(sep).join('/')
  const specifier = path.startsWith('.') ? path : './' + path
  return `export * from ${JSON.stringify(specifier)};${defaultExport ? `\nexport { default } from ${JSON.stringify(specifier)};` : ''}`
}
