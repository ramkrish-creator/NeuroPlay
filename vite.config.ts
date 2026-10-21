import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const EVALUATION_ROUTE = '/__focus-finder-dqn-evaluation'
const MAX_REPORT_BYTES = 1_000_000
const METRIC_KEYS = [
  'dqnAccuracy',
  'baselineAccuracy',
  'dqnReward',
  'baselineReward',
  'dqnFatigue',
  'baselineFatigue',
  'dqnDifficulty',
  'baselineDifficulty',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidEvaluation(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  if (!Number.isInteger(value.trainingSteps) || (value.trainingSteps as number) < 0) return false
  if (!Number.isInteger(value.episodes) || (value.episodes as number) < 1 || (value.episodes as number) > 1000) return false
  if (!Number.isInteger(value.trialsPerEpisode) || (value.trialsPerEpisode as number) < 1 || (value.trialsPerEpisode as number) > 1000) return false
  if (typeof value.generatedAt !== 'string' || Number.isNaN(Date.parse(value.generatedAt))) return false
  if (!Array.isArray(value.points) || value.points.length !== value.episodes) return false
  if (!Number.isInteger(value.dqnWins) || (value.dqnWins as number) < 0 || (value.dqnWins as number) > (value.episodes as number)) return false
  if (METRIC_KEYS.some((key) => typeof value[key] !== 'number' || !Number.isFinite(value[key]))) return false

  return value.points.every((point: unknown) =>
    isRecord(point)
    && typeof point.episode === 'string'
    && METRIC_KEYS.every((key) => typeof point[key] === 'number' && Number.isFinite(point[key])),
  )
}

function focusFinderEvaluationWriter(): Plugin {
  let reportPath = ''
  let pendingWrites = Promise.resolve()

  return {
    name: 'focus-finder-evaluation-writer',
    configureServer(server) {
      reportPath = path.join(server.config.root, 'reports', 'focus-finder-dqn-evaluation.json')

      server.middlewares.use(EVALUATION_ROUTE, (request, response, next) => {
        if (request.method !== 'POST') {
          response.writeHead(405, { Allow: 'POST' })
          response.end('Method Not Allowed')
          return
        }

        const host = request.headers.host
        const origin = request.headers.origin
        if (!host || !origin) {
          response.writeHead(403)
          response.end('A same-origin request is required.')
          return
        }

        try {
          const hostname = new URL(`http://${host}`).hostname
          const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
          if (!isLocalHost || new URL(origin).host !== host) {
            response.writeHead(403)
            response.end('Only same-origin localhost requests are accepted.')
            return
          }
        } catch {
          response.writeHead(403)
          response.end('Invalid request origin.')
          return
        }

        const chunks: Buffer[] = []
        let bodyBytes = 0
        let oversized = false
        request.on('data', (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          bodyBytes += buffer.byteLength
          if (bodyBytes > MAX_REPORT_BYTES) {
            oversized = true
            return
          }
          chunks.push(buffer)
        })
        request.on('error', (error: Error) => {
          next(error)
        })
        request.on('end', () => {
          if (oversized) {
            response.writeHead(413)
            response.end('Evaluation report is too large.')
            return
          }

          let report: unknown
          try {
            report = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          } catch {
            response.writeHead(400)
            response.end('Invalid JSON report.')
            return
          }
          if (!isValidEvaluation(report)) {
            response.writeHead(400)
            response.end('Invalid evaluation report shape.')
            return
          }

          pendingWrites = pendingWrites.catch(() => undefined).then(async () => {
            let latestSteps = -1
            try {
              const existing: unknown = JSON.parse(await readFile(reportPath, 'utf8'))
              if (isRecord(existing) && Number.isInteger(existing.trainingSteps)) {
                latestSteps = existing.trainingSteps as number
              }
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
            }

            if ((report.trainingSteps as number) < latestSteps) return
            await mkdir(path.dirname(reportPath), { recursive: true })
            const temporaryPath = `${reportPath}.tmp`
            await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
            await rename(temporaryPath, reportPath)
          })

          const currentWrite = pendingWrites
          currentWrite.then(() => {
            response.writeHead(200, { 'Content-Type': 'application/json' })
            response.end('{"saved":true}')
          }).catch((error: unknown) => {
            server.config.logger.error('Failed writing Focus Finder DQN evaluation report.', {
              error: error instanceof Error ? error : new Error(String(error)),
            })
            response.writeHead(500)
            response.end('Failed to write evaluation report.')
          })
        })
      })
    },
  }
}

export default defineConfig({
  base: '/sphere-trainer/',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  plugins: [
    focusFinderEvaluationWriter(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'NeuroPlay',
        short_name: 'NeuroPlay',
        description: 'Personalized cognitive training with NeuroPlay.',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'gstatic-fonts', expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
})
