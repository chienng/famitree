import initSqlJs, { type Database } from 'sql.js'
import { v4 as uuid } from 'uuid'
import type { Person, FamilyTreeState, Relationship } from './types'

// WASM bundled by Vite so it is served at the correct URL (avoids SPA fallback returning HTML)
import wasmUrl from './assets/sql-wasm.wasm?url'

const SESSION_KEY = 'famitree-user-id'

/** SQLite file magic header (first 16 bytes). */
const SQLITE_HEADER = new TextEncoder().encode('SQLite format 3\0')

function isValidSqliteBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 16) return false
  const u = new Uint8Array(buffer, 0, 16)
  return SQLITE_HEADER.every((b, i) => u[i] === b)
}

let db: Database | null = null
let state: FamilyTreeState = { people: [], relationships: [] }
let currentUserId: string | null = null
const listeners = new Set<() => void>()
let initPromise: Promise<void> | null = null
/** True when GET /api/db returned 404 or 200 with SQLite (our server). Avoids POST 404 when using Vite dev. */
let serverHasDbApi = false

export interface User {
  id: string
  username: string
  /** Person id of the user's default branch (for tree/reminders filter). */
  defaultBranchPersonId?: string | null
}

export interface UserRow {
  id: string
  username: string
  disabled: boolean
  updatedAt?: string
  defaultBranchPersonId?: string | null
}

function emit(): void {
  listeners.forEach((l) => l())
}

/** Ensure a value is never null/empty for people.name (NOT NULL column). */
function safePersonName(value: unknown): string {
  if (value == null) return '(Unnamed)'
  const s = String(value).trim()
  return s || '(Unnamed)'
}

function createTables(dbInstance: Database): void {
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `)
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      birth_date TEXT,
      death_date TEXT,
      gender TEXT,
      notes TEXT,
      avatar TEXT
    )
  `)
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      type TEXT NOT NULL,
      person_id TEXT NOT NULL,
      related_id TEXT NOT NULL
    )
  `)
}

function ensureUserColumns(dbInstance: Database): void {
  try {
    dbInstance.run('ALTER TABLE people ADD COLUMN user_id TEXT')
  } catch {
    // column already exists
  }
  try {
    dbInstance.run('ALTER TABLE relationships ADD COLUMN user_id TEXT')
  } catch {
    // column already exists
  }
  try {
    dbInstance.run('ALTER TABLE users ADD COLUMN disabled INTEGER DEFAULT 0')
  } catch {
    // column already exists
  }
  try {
    dbInstance.run('ALTER TABLE people ADD COLUMN title TEXT')
  } catch {
    // column already exists
  }
  try {
    dbInstance.run('ALTER TABLE people ADD COLUMN address TEXT')
  } catch {
    // column already exists
  }
  try {
    dbInstance.run('ALTER TABLE users ADD COLUMN updated_at TEXT')
  } catch {
    // column already exists
  }
  try {
    dbInstance.run('ALTER TABLE users ADD COLUMN default_branch_person_id TEXT')
  } catch {
    // column already exists
  }
}

function migrateExistingDataToDefaultUser(dbInstance: Database): void {
  const stmt = dbInstance.prepare('SELECT id FROM users LIMIT 1')
  if (!stmt.step()) {
    stmt.free()
    return
  }
  const row = stmt.getAsObject() as { id: string }
  stmt.free()
  const defaultId = row.id
  const updPeople = dbInstance.prepare('UPDATE people SET user_id = ? WHERE user_id IS NULL')
  updPeople.bind([defaultId])
  updPeople.step()
  updPeople.free()
  const updRels = dbInstance.prepare('UPDATE relationships SET user_id = ? WHERE user_id IS NULL')
  updRels.bind([defaultId])
  updRels.step()
  updRels.free()
}

function loadStateFromDb(dbInstance: Database, userId: string | null): FamilyTreeState {
  if (!userId) return { people: [], relationships: [] }
  const people: Person[] = []
  const stmt = dbInstance.prepare(
    'SELECT id, name, title, address, birth_date, death_date, gender, notes, avatar FROM people WHERE user_id = ?'
  )
  stmt.bind([userId])
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, string | undefined>
    people.push({
      id: row.id as string,
      name: row.name as string,
      title: row.title ?? undefined,
      address: row.address ?? undefined,
      birthDate: row.birth_date ?? undefined,
      deathDate: row.death_date ?? undefined,
      gender: (row.gender as Person['gender']) ?? undefined,
      notes: row.notes ?? undefined,
      avatar: row.avatar ?? undefined,
    })
  }
  stmt.free()

  const relationships: Relationship[] = []
  const relStmt = dbInstance.prepare(
    'SELECT id, type, person_id, related_id FROM relationships WHERE user_id = ?'
  )
  relStmt.bind([userId])
  while (relStmt.step()) {
    const row = relStmt.getAsObject() as Record<string, string>
    relationships.push({
      id: row.id,
      type: row.type as Relationship['type'],
      personId: row.person_id,
      relatedId: row.related_id,
    })
  }
  relStmt.free()

  return { people, relationships }
}

/** Persist in-memory DB: always save to file (POST /api/db). */
function persistDb(): void {
  if (!db) return
  if (!serverHasDbApi || typeof fetch === 'undefined') return
  const data = db.export()
  fetch('/api/db', {
    method: 'POST',
    body: new Blob([new Uint8Array(data)]),
    headers: { 'Content-Type': 'application/octet-stream' },
  }).catch((error) => {
    console.error("Failed to persist DB", error);
  })
}

/** Export the current SQLite database as a binary blob (e.g. for download as .sqlite file). */
export function exportDatabase(): Uint8Array | null {
  if (!db) return null
  return db.export()
}

/** Replace the in-memory database with the given SQLite file. Call after init(). Logs out and reloads state. */
export async function loadDatabaseFromBuffer(buffer: ArrayBuffer): Promise<void> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  if (db) {
    db.close()
    db = null
  }
  db = new SQL.Database(new Uint8Array(buffer))
  createTables(db)
  ensureUserColumns(db)
  currentUserId = null
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(SESSION_KEY)
  state = loadStateFromDb(db, null)
  emit()
}

async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function createDefaultAdminIfNeeded(dbInstance: Database): Promise<void> {
  const stmt = dbInstance.prepare('SELECT COUNT(*) as n FROM users')
  stmt.step()
  const row = stmt.getAsObject() as { n: number }
  stmt.free()
  if (row.n > 0) return
  const id = uuid()
  const hash = await hashPassword('admin123')
  if (!hash || typeof hash !== 'string') throw new Error('Failed to hash admin password')
  const ins = dbInstance.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)')
  ins.bind([id, 'admin', hash])
  ins.step()
  ins.free()
  migrateExistingDataToDefaultUser(dbInstance)
  persistDb()
}

/** Initialize SQLite and load state from server file (GET /api/db). */
export function init(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    try {
      const SQL = await initSqlJs({
        locateFile: () => wasmUrl,
      })
      let buffer: ArrayBuffer | null = null
      if (typeof fetch !== 'undefined') {
        try {
          const res = await fetch('/api/db')
          if (res.status === 404) {
            serverHasDbApi = true
          } else if (res.ok) {
            const raw = await res.arrayBuffer()
            if (isValidSqliteBuffer(raw)) {
              buffer = raw
              serverHasDbApi = true
            }
          }
        } catch {
          // no server or CORS
        }
      }
      db = buffer ? new SQL.Database(new Uint8Array(buffer)) : new SQL.Database()
      createTables(db)
      ensureUserColumns(db)
      await createDefaultAdminIfNeeded(db)
      const stored = sessionStorage.getItem(SESSION_KEY)
      if (stored && db) {
        const stmtUser = db.prepare('SELECT id, username FROM users WHERE id = ? AND (COALESCE(disabled, 0) = 0)')
        stmtUser.bind([stored])
        if (stmtUser.step()) {
          const u = stmtUser.getAsObject() as { id: string; username: string }
          currentUserId = u.id
        }
        stmtUser.free()
      }
      state = loadStateFromDb(db!, currentUserId)
    } catch (e) {
      initPromise = null
      throw e
    }
  })()
  return initPromise
}

export function getState(): FamilyTreeState {
  return state
}

export function getCurrentUser(): User | null {
  if (!currentUserId || !db) return null
  const stmt = db.prepare('SELECT id, username, default_branch_person_id FROM users WHERE id = ?')
  stmt.bind([currentUserId])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const u = stmt.getAsObject() as { id: string; username: string; default_branch_person_id?: string | null }
  stmt.free()
  return {
    id: u.id,
    username: u.username,
    defaultBranchPersonId: u.default_branch_person_id ?? null,
  }
}

export function setCurrentUserId(userId: string | null): void {
  currentUserId = userId
  if (userId) sessionStorage.setItem(SESSION_KEY, userId)
  else sessionStorage.removeItem(SESSION_KEY)
  if (db) state = loadStateFromDb(db, currentUserId)
  emit()
}

/** Set the current user's default branch (person id). Pass null to clear. */
export function setDefaultBranchPersonId(personId: string | null): void {
  if (!db || !currentUserId) return
  const stmt = db.prepare('UPDATE users SET default_branch_person_id = ? WHERE id = ?')
  stmt.bind([personId ?? null, currentUserId])
  stmt.step()
  stmt.free()
  persistDb()
  emit()
}

export async function login(username: string, password: string): Promise<User | null> {
  if (!db) return null
  const hash = await hashPassword(password)
  const stmt = db.prepare(
    'SELECT id, username, default_branch_person_id FROM users WHERE username = ? AND password_hash = ? AND (COALESCE(disabled, 0) = 0)'
  )
  stmt.bind([username.trim(), hash])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const u = stmt.getAsObject() as { id: string; username: string; default_branch_person_id?: string | null }
  stmt.free()
  const user: User = {
    id: u.id,
    username: u.username,
    defaultBranchPersonId: u.default_branch_person_id ?? null,
  }
  setCurrentUserId(user.id)
  return user
}

/** Create a new user. Only the admin user is allowed to call this. */
export async function createUserByAdmin(
  newUsername: string,
  newPassword: string,
  defaultBranchPersonId?: string | null
): Promise<{ error?: string }> {
  if (!db) return { error: 'Database not ready' }
  const current = getCurrentUser()
  if (!current || current.username !== 'admin') return { error: 'auth.onlyAdminCanCreateUsers' }
  const un = newUsername.trim()
  if (!un) return { error: 'Username required' }
  if (newPassword.length < 4) return { error: 'Password must be at least 4 characters' }
  const hash = await hashPassword(newPassword)
  if (!hash || typeof hash !== 'string') return { error: 'Failed to hash password' }
  const id = uuid()
  const safeUn = un || '(unnamed)'
  const now = new Date().toISOString()
  try {
    const stmt = db.prepare('INSERT INTO users (id, username, password_hash, updated_at, default_branch_person_id) VALUES (?, ?, ?, ?, ?)')
    stmt.bind([id, safeUn, hash, now, defaultBranchPersonId ?? null])
    stmt.step()
    stmt.free()
  } catch (e) {
    const msg = String(e)
    if (msg.includes('UNIQUE') || msg.includes('unique')) return { error: 'Username already taken' }
    throw e
  }
  persistDb()
  return {}
}

/** List all users (admin only). */
export function getUsers(): UserRow[] {
  if (!db || !isAdmin()) return []
  const rows: UserRow[] = []
  const stmt = db.prepare('SELECT id, username, COALESCE(disabled, 0) as disabled, updated_at, default_branch_person_id FROM users')
  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: string; username: string; disabled: number; updated_at?: string; default_branch_person_id?: string | null }
    rows.push({
      id: row.id,
      username: row.username,
      disabled: row.disabled !== 0,
      updatedAt: row.updated_at ?? undefined,
      defaultBranchPersonId: row.default_branch_person_id ?? undefined,
    })
  }
  stmt.free()
  return rows
}

/** Update a user (admin only). */
export async function updateUserByAdmin(
  userId: string,
  updates: { username?: string; password?: string; disabled?: boolean; defaultBranchPersonId?: string | null }
): Promise<{ error?: string }> {
  if (!db || !isAdmin()) return { error: 'Forbidden' }
  const current = getCurrentUser()
  if (!current) return { error: 'Not logged in' }
  const targetStmt = db.prepare('SELECT id, username FROM users WHERE id = ?')
  targetStmt.bind([userId])
  if (!targetStmt.step()) {
    targetStmt.free()
    return { error: 'User not found' }
  }
  const target = targetStmt.getAsObject() as { id: string; username: string }
  targetStmt.free()

  if (updates.defaultBranchPersonId !== undefined) {
    const stmt = db.prepare('UPDATE users SET default_branch_person_id = ? WHERE id = ?')
    stmt.bind([updates.defaultBranchPersonId ?? null, userId])
    stmt.step()
    stmt.free()
  }
  if (updates.username !== undefined) {
    const un = String(updates.username).trim()
    if (!un) return { error: 'Username required' }
    try {
      const stmt = db.prepare('UPDATE users SET username = ? WHERE id = ?')
      stmt.bind([un, userId])
      stmt.step()
      stmt.free()
    } catch (e) {
      const msg = String(e)
      if (msg.includes('UNIQUE') || msg.includes('unique')) return { error: 'Username already taken' }
      throw e
    }
  }
  if (updates.password !== undefined && updates.password.length > 0) {
    if (updates.password.length < 4) return { error: 'Password must be at least 4 characters' }
    const hash = await hashPassword(updates.password)
    if (!hash) return { error: 'Failed to hash password' }
    const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    stmt.bind([hash, userId])
    stmt.step()
    stmt.free()
  }
  if (updates.disabled !== undefined) {
    if (updates.disabled && target.username === 'admin') return { error: 'auth.cannotDisableAdmin' }
    const stmt = db.prepare('UPDATE users SET disabled = ? WHERE id = ?')
    stmt.bind([updates.disabled ? 1 : 0, userId])
    stmt.step()
    stmt.free()
    if (updates.disabled && current.id === userId) {
      setCurrentUserId(null)
      sessionStorage.removeItem(SESSION_KEY)
      if (db) state = loadStateFromDb(db, null)
      emit()
    }
  }
  const didUpdate = updates.username !== undefined || (updates.password !== undefined && updates.password.length > 0) || updates.disabled !== undefined || updates.defaultBranchPersonId !== undefined
  if (didUpdate) {
    const now = new Date().toISOString()
    const updStmt = db.prepare('UPDATE users SET updated_at = ? WHERE id = ?')
    updStmt.bind([now, userId])
    updStmt.step()
    updStmt.free()
  }
  persistDb()
  return {}
}

/** Delete a user (admin only). Cannot delete self. */
export function deleteUserByAdmin(userId: string): { error?: string } {
  if (!db || !isAdmin()) return { error: 'Forbidden' }
  const current = getCurrentUser()
  if (!current) return { error: 'Not logged in' }
  if (current.id === userId) return { error: 'auth.cannotDeleteSelf' }
  const checkStmt = db.prepare('SELECT id FROM users WHERE id = ?')
  checkStmt.bind([userId])
  if (!checkStmt.step()) {
    checkStmt.free()
    return { error: 'User not found' }
  }
  checkStmt.free()
  const delStmt = db.prepare('DELETE FROM users WHERE id = ?')
  delStmt.bind([userId])
  delStmt.step()
  delStmt.free()
  persistDb()
  return {}
}

export function logout(): void {
  setCurrentUserId(null)
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function isAdmin(): boolean {
  const u = getCurrentUser()
  return u?.username === 'admin'
}

export function addPerson(person: Omit<Person, 'id'>): Person {
  const rawName = person?.name != null ? String(person.name).trim() : ''
  if (!rawName) throw new Error('Person name is required')
  const nameValue = rawName
  const newPerson: Person = { ...person, name: nameValue, id: uuid() }
  const current = getCurrentUser()
  if (!db || !current || !isAdmin()) return newPerson
  try {
    const stmt = db.prepare(
      'INSERT INTO people (id, user_id, name, title, address, birth_date, death_date, gender, notes, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    stmt.bind([
      newPerson.id,
      current.id,
      nameValue,
      newPerson.title ?? null,
      newPerson.address ?? null,
      newPerson.birthDate ?? null,
      newPerson.deathDate ?? null,
      newPerson.gender ?? null,
      newPerson.notes ?? null,
      newPerson.avatar ?? null,
    ])
    stmt.step()
    stmt.free()
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e))
  }
  state = { ...state, people: [...state.people, newPerson] }
  persistDb()
  emit()
  return newPerson
}

/** Import a person from CSV backup (preserves id). Admin only. */
export function importPerson(person: Person): void {
  if (!db || !currentUserId || !isAdmin()) return
  const name = safePersonName(person?.name)
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO people (id, user_id, name, title, address, birth_date, death_date, gender, notes, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  stmt.bind([
    person.id,
    currentUserId,
    name,
    person.title ?? null,
    person.address ?? null,
    person.birthDate ?? null,
    person.deathDate ?? null,
    person.gender ?? null,
    person.notes ?? null,
    person.avatar ?? null,
  ])
  stmt.step()
  stmt.free()
  const existing = state.people.find((p) => p.id === person.id)
  const imported = { ...person, name }
  if (existing) {
    state = { ...state, people: state.people.map((p) => (p.id === person.id ? imported : p)) }
  } else {
    state = { ...state, people: [...state.people, imported] }
  }
  persistDb()
  emit()
}

export function updatePerson(id: string, updates: Partial<Omit<Person, 'id'>>): void {
  if (!isAdmin()) return
  const p = state.people.find((x) => x.id === id)
  if (!p || !db) return
  const next = { ...p, ...updates }
  const safeName = safePersonName(next.name)
  const stmt = db.prepare(
    'UPDATE people SET name = ?, title = ?, address = ?, birth_date = ?, death_date = ?, gender = ?, notes = ?, avatar = ? WHERE id = ?'
  )
  stmt.bind([
    safeName,
    next.title ?? null,
    next.address ?? null,
    next.birthDate ?? null,
    next.deathDate ?? null,
    next.gender ?? null,
    next.notes ?? null,
    next.avatar ?? null,
    id,
  ])
  stmt.step()
  stmt.free()
  state = {
    ...state,
    people: state.people.map((x) => (x.id === id ? { ...next, name: safeName } : x)),
  }
  persistDb()
  emit()
}

export function deletePerson(id: string): void {
  if (!db || !isAdmin()) return
  const delPeople = db.prepare('DELETE FROM people WHERE id = ?')
  delPeople.bind([id])
  delPeople.step()
  delPeople.free()
  const delRels = db.prepare('DELETE FROM relationships WHERE person_id = ? OR related_id = ?')
  delRels.bind([id, id])
  delRels.step()
  delRels.free()
  state = {
    people: state.people.filter((p) => p.id !== id),
    relationships: state.relationships.filter((r) => r.personId !== id && r.relatedId !== id),
  }
  persistDb()
  emit()
}

export function addParentChild(parentId: string, childId: string): void {
  if (!isAdmin() || parentId === childId || !db) return
  const exists = state.relationships.some(
    (r) =>
      r.type === 'parent-child' &&
      ((r.personId === parentId && r.relatedId === childId) ||
        (r.personId === childId && r.relatedId === parentId))
  )
  if (exists) return
  const id = uuid()
  if (!currentUserId) return
  const stmt = db.prepare(
    "INSERT INTO relationships (id, user_id, type, person_id, related_id) VALUES (?, ?, 'parent-child', ?, ?)"
  )
  stmt.bind([id, currentUserId, parentId, childId])
  stmt.step()
  stmt.free()
  state = {
    ...state,
    relationships: [
      ...state.relationships,
      { id, type: 'parent-child', personId: parentId, relatedId: childId },
    ],
  }
  persistDb()
  emit()
}

export function addSpouse(personId: string, spouseId: string): void {
  if (!isAdmin() || personId === spouseId || !db) return
  const exists = state.relationships.some(
    (r) =>
      r.type === 'spouse' &&
      ((r.personId === personId && r.relatedId === spouseId) ||
        (r.personId === spouseId && r.relatedId === personId))
  )
  if (exists) return
  const id = uuid()
  if (!currentUserId) return
  const stmt = db.prepare(
    "INSERT INTO relationships (id, user_id, type, person_id, related_id) VALUES (?, ?, 'spouse', ?, ?)"
  )
  stmt.bind([id, currentUserId, personId, spouseId])
  stmt.step()
  stmt.free()
  state = {
    ...state,
    relationships: [...state.relationships, { id, type: 'spouse', personId, relatedId: spouseId }],
  }
  persistDb()
  emit()
}

export function removeRelationship(id: string): void {
  if (!db || !isAdmin()) return
  const stmt = db.prepare('DELETE FROM relationships WHERE id = ?')
  stmt.bind([id])
  stmt.step()
  stmt.free()
  state = {
    ...state,
    relationships: state.relationships.filter((r) => r.id !== id),
  }
  persistDb()
  emit()
}

export function getPerson(id: string): Person | undefined {
  return state.people.find((p) => p.id === id)
}

export function getChildrenIds(parentId: string): string[] {
  return state.relationships
    .filter((r) => r.type === 'parent-child' && r.personId === parentId)
    .map((r) => r.relatedId)
}

export function getParentIds(childId: string): string[] {
  return state.relationships
    .filter((r) => r.type === 'parent-child' && r.relatedId === childId)
    .map((r) => r.personId)
}

export function getSpouseId(personId: string): string | undefined {
  const r = state.relationships.find(
    (r) => r.type === 'spouse' && (r.personId === personId || r.relatedId === personId)
  )
  return r ? (r.personId === personId ? r.relatedId : r.personId) : undefined
}

export function getParentRelationships(childId: string): { id: string; person: Person }[] {
  return state.relationships
    .filter((r) => r.type === 'parent-child' && r.relatedId === childId)
    .map((r) => ({ id: r.id, person: state.people.find((p) => p.id === r.personId)! }))
    .filter((x) => x.person)
}

export function getChildRelationships(parentId: string): { id: string; person: Person }[] {
  return state.relationships
    .filter((r) => r.type === 'parent-child' && r.personId === parentId)
    .map((r) => ({ id: r.id, person: state.people.find((p) => p.id === r.relatedId)! }))
    .filter((x) => x.person)
}

export function getSpouseRelationship(personId: string): { id: string; person: Person } | null {
  const r = state.relationships.find(
    (r) => r.type === 'spouse' && (r.personId === personId || r.relatedId === personId)
  )
  if (!r) return null
  const spouseId = r.personId === personId ? r.relatedId : r.personId
  const person = state.people.find((p) => p.id === spouseId)
  return person ? { id: r.id, person } : null
}
