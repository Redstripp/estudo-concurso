import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const port = Number(process.env.PORT || 4173)

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8'
}

function resolverCaminho(url) {
  const pathname = decodeURIComponent(new URL(url, `http://localhost:${port}`).pathname)
  const relativo = pathname === '/' ? 'index.html' : pathname.slice(1)
  const caminho = resolve(join(root, normalize(relativo)))

  if (!caminho.startsWith(root)) return null
  if (!existsSync(caminho) || !statSync(caminho).isFile()) return null

  return caminho
}

const server = createServer((req, res) => {
  const caminho = resolverCaminho(req.url || '/')

  if (!caminho) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Arquivo nao encontrado')
    return
  }

  res.writeHead(200, {
    'content-type': mimeTypes[extname(caminho)] || 'application/octet-stream'
  })
  createReadStream(caminho).pipe(res)
})

server.listen(port, () => {
  console.log(`Estudo Concurso rodando em http://localhost:${port}`)
})
