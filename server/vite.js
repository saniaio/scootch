// Vite: save Scootch's notes from the dev server. In vite.config.js:
//   import scootchNotes from 'scootch/vite'
//   export default { plugins: [react(), scootchNotes()] }
// Serves /api/notes (or `path`) during `vite dev` only; production builds are untouched.
import { createStore, handle, refusal } from './store.js'

export default function scootchNotes({ path: route = '/api/notes', dir } = {}) {
  const store = createStore(dir ? { dir } : undefined)
  return {
    name: 'scootch-notes',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || req.url.split('?')[0] !== route) return next()
        const send = (status, out) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(out))
        }
        const no = refusal(req.method, (name) => req.headers[name])
        if (no) return send(403, { error: no })
        // A note is small (a sketch's strokes are the most it holds): refuse anything far bigger
        let raw = ''
        for await (const chunk of req) {
          raw += chunk
          if (raw.length > 5_000_000) return send(413, { error: 'That note is too big' })
        }
        let body = null
        try {
          body = raw ? JSON.parse(raw) : null
        } catch {}
        const { status, body: out } = await handle(store, req.method, req.url, body)
        send(status, out)
      })
    },
  }
}
