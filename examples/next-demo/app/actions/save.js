'use server'
export async function save(previous, data) {
  await new Promise(resolve => setTimeout(resolve, 250))
  return { count: previous.count + 1, name: String(data.get('name')) }
}
