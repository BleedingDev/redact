import { clearSession } from '../../store'

export async function POST(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return new Response('Origin mismatch', { status: 403 })
  await clearSession()
  return Response.json({ reset: true })
}
