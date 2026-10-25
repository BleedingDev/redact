// Vinext emits a stack-only console entry after reporting a caught error.
// This classifier is used only after the deliberate boundary failure has been
// verified in the page, never to suppress errors during ordinary scenarios.
export function isExpectedVinextBoundaryLog(message) {
  if (message === 'Failed to load resource: the server responded with a status of 500 ()') return true
  const [heading, ...lines] = message.replace(/\\n/g, '\n').split('\n')
  return heading === 'The above error occurred in a React component:' &&
    lines.some(line => line.length > 0) &&
    lines.every(line => line === '' || /^ {4}at .+$/.test(line) || /^(?:[\w.$]*(?: \[Server\])?)@(?:https?:\/\/localhost:\d+\/\S+:\d+:\d+|unknown:\d+:\d+)$/.test(line) || /^[\w.$]+@$/.test(line))
}
