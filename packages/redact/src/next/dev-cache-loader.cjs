// Next 16.2 reads navigation timing before Firefox finalizes streamed body
// sizes. A zero transfer size alone also describes an unfinished response.
// Keep Next's debug-channel cache restoration and require a decoded body.
module.exports = function (source) {
  if (!source.includes('function wasServedFromCache()')) return source
  const original = 'return entry?.transferSize === 0;'
  const corrected = 'return entry?.transferSize === 0 && entry.decodedBodySize > 0;'
  if (source.includes(corrected) && !source.includes(original)) return source
  if (source.split(original).length !== 2) {
    throw new Error('Unsupported Next.js 16.2 debug-channel cache detection. The Redact integration needs an update for this Next.js build.')
  }
  return source.replace(original, corrected)
}
