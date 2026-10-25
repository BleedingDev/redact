'use server'

export async function increment(value) {
  if (!Number.isSafeInteger(value)) throw new Error('Expected an integer')
  return value + 1
}
