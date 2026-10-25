import React from 'react'
export function GET() { return Response.json({ version: React.version, redact: !!globalThis[Symbol.for('@tanstack/redact.ReactSharedInternals')] }) }
