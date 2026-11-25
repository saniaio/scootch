// Next.js App Router: save Scootch's notes. Add app/api/notes/route.js with:
//   export { GET, POST, PATCH, DELETE } from 'scootch/next'
// Works on the dev server only; in production every method answers 404.
import { createStore, handle, refusal } from './store.js'

const store = createStore()
const dev = process.env.NODE_ENV === 'development'

async function respond(request) {
  if (!dev) return Response.json({ error: 'Notes only work on the dev server' }, { status: 404 })
  const no = refusal(request.method, (name) => request.headers.get(name) ?? undefined)
  if (no) return Response.json({ error: no }, { status: 403 })
  const body = request.method === 'GET' ? null : await request.json().catch(() => null)
  const { status, body: out } = await handle(store, request.method, request.url, body)
  return Response.json(out, { status })
}

export const GET = respond
export const POST = respond
export const PATCH = respond
export const DELETE = respond
