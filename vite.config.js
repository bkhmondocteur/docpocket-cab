import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Plugin Pont de Synchronisation DocPocket Cab (Haute Performance & Zéro Configuration)
 * Compatible API Firebase Realtime Database REST.
 * Supporte le streaming sans blocage, écriture asynchrone débouncée, et drainage propre des requêtes PUT/POST.
 */
function docpocketBridgePlugin() {
  const storePath = path.resolve(__dirname, 'bridge_store.json')
  let store = {}
  try {
    if (fs.existsSync(storePath)) {
      store = JSON.parse(fs.readFileSync(storePath, 'utf8'))
    }
  } catch (e) {
    store = {}
  }

  let saveTimeout = null
  const scheduleSaveStore = () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      fs.writeFile(storePath, JSON.stringify(store), 'utf8', (err) => {
        if (err) console.warn('Erreur écriture bridge store:', err.message)
      })
    }, 400)
  }

  const handleMiddleware = (middlewares) => {
    middlewares.use('/docpocket_bridge', (req, res, next) => {
      // CORS complet pour Mobile, Wi-Fi, Cloudflare et PC
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

      if (req.method === 'OPTIONS') {
        res.statusCode = 204
        return res.end()
      }

      const rawUrl = req.url.split('?')[0] || ''
      const cleanPath = rawUrl.replace(/^\/+/, '').replace(/\.json$/, '')

      // Ping de test de connexion ultra-rapide avec drainage
      if (cleanPath === 'ping' || cleanPath.endsWith('/ping')) {
        const sendPing = () => {
          if (res.writableEnded) return
          res.setHeader('Content-Type', 'application/json')
          res.statusCode = 200
          res.end(JSON.stringify({
            status: 'ok',
            service: 'DocPocket Auto Bridge',
            timestamp: Date.now()
          }))
        }
        if (req.readableEnded) {
          sendPing()
        } else {
          req.resume()
          req.on('end', sendPing)
        }
        return
      }

      const parts = cleanPath.split('/').filter(Boolean)

      if (req.method === 'GET') {
        let current = store
        for (const p of parts) {
          if (current && typeof current === 'object' && p in current) {
            current = current[p]
          } else {
            current = null
            break
          }
        }
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = 200
        return res.end(JSON.stringify(current))
      }

      if (req.method === 'PUT' || req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          let data = null
          try {
            data = JSON.parse(body)
          } catch {
            data = body
          }

          if (parts.length > 0) {
            let current = store
            for (let i = 0; i < parts.length - 1; i++) {
              const p = parts[i]
              if (!current[p] || typeof current[p] !== 'object') {
                current[p] = {}
              }
              current = current[p]
            }
            const last = parts[parts.length - 1]
            current[last] = data
            scheduleSaveStore()
          }

          res.setHeader('Content-Type', 'application/json')
          res.statusCode = 200
          // Réponse légère : ne pas renvoyer le chunk complet de 150Ko pour économiser la bande passante mobile
          return res.end(JSON.stringify({ ok: true, path: cleanPath }))
        })
        return
      }

      if (req.method === 'DELETE') {
        if (parts.length > 0) {
          let current = store
          for (let i = 0; i < parts.length - 1; i++) {
            const p = parts[i]
            if (current && typeof current === 'object' && p in current) {
              current = current[p]
            } else {
              break
            }
          }
          const last = parts[parts.length - 1]
          if (current && typeof current === 'object' && last in current) {
            delete current[last]
            scheduleSaveStore()
          }
        }
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = 200
        return res.end(JSON.stringify({ success: true }))
      }

      next()
    })
  }

  return {
    name: 'docpocket-bridge-plugin',
    configureServer(server) {
      handleMiddleware(server.middlewares)
    },
    configurePreviewServer(server) {
      handleMiddleware(server.middlewares)
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), docpocketBridgePlugin()],
  preview: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  }
})
