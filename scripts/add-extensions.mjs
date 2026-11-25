// After tsc: add .js to relative imports in dist, so the package works as plain ES modules
// (Next, Vite and Node all accept './Button.js'; strict ones reject './Button').
import fs from 'node:fs'
import path from 'node:path'

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))

for (const file of walk('dist').filter((f) => /\.(js|d\.ts)$/.test(f))) {
  const src = fs.readFileSync(file, 'utf8')
  const out = src.replace(/(from\s+|import\s*\(\s*)(['"])(\.{1,2}\/[^'"]+?)\2/g, (m, pre, q, spec) =>
    /\.(js|css|json)$/.test(spec) ? m : `${pre}${q}${spec}.js${q}`,
  )
  if (out !== src) fs.writeFileSync(file, out)
}
