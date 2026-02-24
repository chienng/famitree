/**
 * Optional server that keeps the SQLite database in a file on disk.
 * Run: node server.js
 * Then open http://localhost:3000 (or the port shown).
 * Database file: ./data/famitree.sqlite
 */
import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, 'dist')
const DB_DIR = path.join(__dirname, 'data')
const DB_FILE = path.join(DB_DIR, 'famitree.sqlite')

const app = express()

// Raw body for POST /api/db (binary SQLite file)
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }))

// GET: return the database file (404 if not exists)
app.get('/api/db', (req, res) => {
  if (!fs.existsSync(DB_FILE)) {
    return res.status(404).end()
  }
  res.setHeader('Content-Type', 'application/vnd.sqlite3')
  res.sendFile(DB_FILE)
})

// POST: save the database file to disk
app.post('/api/db', (req, res) => {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true })
    }
    const body = req.body
    if (body && Buffer.isBuffer(body)) {
      fs.writeFileSync(DB_FILE, body)
    }
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(500).end()
  }
})

// Serve static app
app.use(express.static(DIST))
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'))
})

// Ensure data directory exists so the DB file path is predictable
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
  console.log(`Created ${DB_DIR}`)
}

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`FamiTree server: http://localhost:${PORT}`)
  console.log(`Database file: ${DB_FILE} (created on first save)`)
})
