'use server'

export async function saveStatus(previous, data) {
  await new Promise(resolve => setTimeout(resolve, 300))
  return { status: String(data.get('status')), saved: true }
}
