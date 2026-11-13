import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Lista os PNGs presentes em public/assets para o cliente só pedir o que existe.
// Ao adicionar assets com o `npm run dev:client` aberto, reinicie o comando.
const assetsDir = resolve(fileURLToPath(import.meta.url), '../public/assets')
function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.png') ? [relative(assetsDir, p).split('\\').join('/')] : []
  })
}

export default defineConfig({
  define: { __ASSET_FILES__: JSON.stringify(walk(assetsDir)) },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000', '/ws': { target: 'ws://localhost:3000', ws: true } } },
  build: { chunkSizeWarningLimit: 2000 },
})
