// Scootch's notes, saved to .notes/notes.json in the app's folder (dev only; add .notes/ to .gitignore).
// You (or an AI agent) read that file directly, answer each note and mark it resolved: no outside service.
// Shared by the Next.js route handlers (./next.js) and the Vite plugin (./vite.js).
import { promises as fs } from 'node:fs'
import path from 'node:path'

export function createStore({ dir = path.join(process.cwd(), '.notes') } = {}) {
  const file = path.join(dir, 'notes.json')

  async function read() {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'))
    } catch {
      return []
    }
  }

  // Write to a temp file, then swap it in: a reader never sees half a file.
  async function write(all) {
    await fs.mkdir(dir, { recursive: true })
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
    await fs.writeFile(tmp, JSON.stringify(all, null, 2) + '\n')
    await fs.rename(tmp, file)
  }

  // One change at a time: each read-change-write waits for the one before, so two saves at once can't overwrite each other.
  let queue = Promise.resolve()
  const serial = (fn) => {
    const run = queue.then(fn, fn)
    queue = run.catch(() => {})
    return run
  }

  return {
    // The notes on one page, or all of them
    list: async (page) => {
      const all = await read()
      return page ? all.filter((n) => n.page === page) : all
    },
    add: (note) =>
      serial(async () => {
        const all = await read()
        const saved = { status: 'open', ...note, at: note.at ?? new Date().toISOString() }
        all.push(saved)
        await write(all)
        return saved
      }),
    update: (id, patch) =>
      serial(async () => {
        const all = await read()
        const i = all.findIndex((n) => n.id === id)
        if (i === -1) return null
        all[i] = { ...all[i], ...patch }
        await write(all)
        return all[i]
      }),
    remove: (id) => serial(async () => write((await read()).filter((n) => n.id !== id))),
  }
}

// Notes are read and acted on by an agent, so only the app's own page may read or write them. Any other
// site open in the same browser can send requests to a dev server on localhost; without this, it could
// plant a note for the agent to follow. header(name) → that request header's value, or undefined.
//   - Browsers say where a request comes from (Sec-Fetch-Site): only this app's own pages are let in.
//   - Older browsers: the Origin has to be the host that was asked.
//   - A change has to be sent as JSON, which a page on another site can't do without asking first.
// Requests with none of these headers (curl, a script) are local tools, and are let in.
export function refusal(method, header) {
  const site = header('sec-fetch-site')
  if (site) {
    if (site !== 'same-origin' && site !== 'none') return 'Notes can only be used from the app itself'
  } else {
    const origin = header('origin')
    if (origin) {
      let host = null
      try {
        host = new URL(origin).host
      } catch {}
      if (host !== header('host')) return 'Notes can only be used from the app itself'
    }
  }
  if (method !== 'GET' && !/^application\/json\b/i.test(header('content-type') ?? '')) return 'Send notes as application/json'
  return null
}

// One request in, one { status, body } out. Both adapters call this, after refusal().
export async function handle(store, method, url, body) {
  const page = new URL(url, 'http://x').searchParams.get('page')
  if (method === 'GET') return { status: 200, body: await store.list(page) }
  if (method === 'POST') {
    if (!body?.id || !body.page) return { status: 400, body: { error: 'A note needs an id and a page' } }
    return { status: 200, body: await store.add(body) }
  }
  if (method === 'PATCH') {
    const { id, ...patch } = body ?? {}
    const updated = await store.update(id, patch)
    return updated ? { status: 200, body: updated } : { status: 404, body: { error: 'No such note' } }
  }
  if (method === 'DELETE') {
    await store.remove(body?.id)
    return { status: 200, body: { ok: true } }
  }
  return { status: 405, body: { error: 'Method not allowed' } }
}
