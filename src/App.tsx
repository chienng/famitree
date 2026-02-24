import { useState, useRef, useEffect } from 'react'
import { getState, subscribe, getUsers, getPerson, getChildrenIds, updateUserByAdmin, deleteUserByAdmin, importPerson, exportDatabase, loadDatabaseFromBuffer, hasServerDbApi } from './store'
import type { UserRow } from './store'
import { buildTree, buildTreeRootedAt, filterTreeByQuery, getMainPersonIds, getBranchPersonIds } from './treeUtils'
import { TreeView } from './TreeView'
import { PersonList } from './PersonList'
import { PersonForm } from './PersonForm'
import { TreeSummary } from './TreeSummary'
import { RemindersView } from './RemindersView'
import { LoginPage } from './LoginPage'
import { PasswordInput } from './PasswordInput'
import { BranchCombobox } from './BranchCombobox'
import { useLocale } from './LocaleContext'
import { useAuth } from './AuthContext'
import { getCurrentAge } from './dateUtils'
import type { Person } from './types'
import './App.css'

export default function App() {
  const { t, locale, setLocale } = useLocale()
  const { user, logout, createUser } = useAuth()

  if (!user) {
    return <LoginPage />
  }
  const [, setTick] = useState(0)
  subscribe(() => setTick((n) => n + 1))

  const state = getState()
  const treeNodes = buildTree()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [view, setView] = useState<'tree' | 'list' | 'users' | 'summary' | 'reminders'>('tree')
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [showUserForm, setShowUserForm] = useState(false)
  const [newUserUsername, setNewUserUsername] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserPasswordConfirm, setNewUserPasswordConfirm] = useState('')
  const [newUserBranchId, setNewUserBranchId] = useState<string | null>(null)
  const [userFormError, setUserFormError] = useState<string | null>(null)
  const [userFormSuccess, setUserFormSuccess] = useState(false)
  const [userList, setUserList] = useState<UserRow[]>([])
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('')
  const [editBranchId, setEditBranchId] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false)
  const [branchSearchQuery, setBranchSearchQuery] = useState('')
  const sidebarRef = useRef<HTMLElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const branchDropdownRef = useRef<HTMLDivElement>(null)
  const importCsvInputRef = useRef<HTMLInputElement>(null)
  const restoreDbInputRef = useRef<HTMLInputElement>(null)
  const isAdmin = user.username === 'admin'

  useEffect(() => {
    if (!userMenuOpen) return
    const close = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [userMenuOpen])

  useEffect(() => {
    if (!branchDropdownOpen) return
    const close = (e: MouseEvent) => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
        setBranchDropdownOpen(false)
        setBranchSearchQuery('')
      }
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [branchDropdownOpen])

  useEffect(() => {
    if (user?.defaultBranchPersonId) setSelectedBranchId(user.defaultBranchPersonId)
  }, [user?.id, user?.defaultBranchPersonId])

  const refreshUserList = () => {
    if (isAdmin) setUserList(getUsers())
  }

  const exportToCsv = () => {
    const state = getState()
    const escape = (v: string | undefined | null): string => {
      const s = v == null ? '' : String(v)
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const headers = ['id', 'name', 'title', 'address', 'birthDate', 'deathDate', 'gender', 'notes']
    const rows = state.people.map((p) =>
      [p.id, p.name, p.title ?? '', p.address ?? '', p.birthDate ?? '', p.deathDate ?? '', p.gender ?? '', p.notes ?? ''].map(escape).join(',')
    )
    const csv = [headers.join(','), ...rows].join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `famitree-backup-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const parseCsvLine = (line: string): string[] => {
    const out: string[] = []
    let i = 0
    while (i < line.length) {
      if (line[i] === '"') {
        let s = ''
        i++
        while (i < line.length) {
          if (line[i] === '"') {
            if (line[i + 1] === '"') { s += '"'; i += 2; continue }
            i++
            break
          }
          s += line[i++]
        }
        out.push(s)
      } else {
        let s = ''
        while (i < line.length && line[i] !== ',') s += line[i++]
        out.push(s.trim())
        if (line[i] === ',') i++
      }
    }
    return out
  }

  const importFromCsv = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        const lines = text.split('\n').filter((l) => l.length > 0)
        if (lines.length < 2) return
        const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase())
        const nameIdx = header.indexOf('name') >= 0 ? header.indexOf('name') : 0
        const cols: Record<string, number> = {}
        ;['id', 'name', 'title', 'address', 'birthdate', 'deathdate', 'gender', 'notes'].forEach((k) => {
          const i = header.indexOf(k)
          if (i >= 0) cols[k] = i
        })
        let count = 0
        for (let r = 1; r < lines.length; r++) {
          const fields = parseCsvLine(lines[r])
          const id = cols['id'] >= 0 && fields[cols['id']] ? fields[cols['id']].trim() : undefined
          const name = (cols['name'] >= 0 && fields[cols['name']] !== undefined ? fields[cols['name']] : fields[nameIdx] ?? '').trim() || '(Unnamed)'
          if (!id) continue
          const person: Person = {
            id,
            name,
            title: cols['title'] >= 0 && fields[cols['title']] ? fields[cols['title']].trim() || undefined : undefined,
            address: cols['address'] >= 0 && fields[cols['address']] ? fields[cols['address']].trim() || undefined : undefined,
            birthDate: cols['birthdate'] >= 0 && fields[cols['birthdate']] ? fields[cols['birthdate']].trim() || undefined : undefined,
            deathDate: cols['deathdate'] >= 0 && fields[cols['deathdate']] ? fields[cols['deathdate']].trim() || undefined : undefined,
            gender: (cols['gender'] >= 0 && fields[cols['gender']] ? fields[cols['gender']].trim() : undefined) as Person['gender'] | undefined,
            notes: cols['notes'] >= 0 && fields[cols['notes']] ? fields[cols['notes']].trim() || undefined : undefined,
          }
          importPerson(person)
          count++
        }
        if (importCsvInputRef.current) importCsvInputRef.current.value = ''
      } catch (_) {
        if (importCsvInputRef.current) importCsvInputRef.current.value = ''
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  useEffect(() => {
    if (showAddForm) sidebarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [showAddForm])

  useEffect(() => {
    if (isAdmin) setUserList(getUsers())
  }, [isAdmin])

  const userSearchTrimmed = userSearchQuery.trim().toLowerCase()
  const filteredUserList =
    userSearchTrimmed === ''
      ? userList
      : userList.filter((row) => row.username.toLowerCase().includes(userSearchTrimmed))

  const trimmedSearch = searchQuery.trim().toLowerCase()
  const maleRootNodes = treeNodes.filter((n) => n.person.gender === 'male')
  const allMaleMembers = state.people
    .filter((p) => {
      if (p.gender !== 'male') return false
      if (p.deathDate?.trim()) return true
      const hasChildren = getChildrenIds(p.id).length > 0
      const age = getCurrentAge(p.birthDate, p.deathDate)
      return hasChildren && (age !== null && age > 60)
    })
    .sort((a, b) => a.name.localeCompare(b.name, locale))
  const getBranchLabel = (node: (typeof treeNodes)[0]) =>
    node.spouse
      ? node.spouse.gender === 'male'
        ? `${node.spouse.name} – ${node.person.name}`
        : `${node.person.name} – ${node.spouse.name}`
      : node.person.name
  const branchSearchLower = branchSearchQuery.trim().toLowerCase()
  const filteredBranchMembers =
    branchSearchLower === ''
      ? allMaleMembers
      : allMaleMembers.filter((p) => p.name.toLowerCase().includes(branchSearchLower))
  const selectedBranchValid =
    selectedBranchId != null && state.people.some((p) => p.id === selectedBranchId && p.gender === 'male')
  const selectedIsRoot = selectedBranchId != null && maleRootNodes.some((n) => n.person.id === selectedBranchId)
  const branchFilteredNodes =
    !selectedBranchValid
      ? treeNodes
      : selectedIsRoot
        ? treeNodes.filter((n) => n.person.id === selectedBranchId)
        : buildTreeRootedAt(selectedBranchId!)
  const filteredTreeNodes =
    trimmedSearch === ''
      ? branchFilteredNodes
      : filterTreeByQuery(branchFilteredNodes, searchQuery)
  const selectedBranchDisplayLabel =
    selectedBranchValid && selectedBranchId
      ? selectedIsRoot
        ? getBranchLabel(maleRootNodes.find((n) => n.person.id === selectedBranchId)!)
        : (getPerson(selectedBranchId)?.name ?? '')
      : ''
  const hasBranchSelector = allMaleMembers.length >= 1
  const listPeopleBase =
    selectedBranchValid && selectedBranchId
      ? state.people.filter((p) => getBranchPersonIds(selectedBranchId!).has(p.id))
      : state.people
  const filteredPeople =
    trimmedSearch === ''
      ? listPeopleBase
      : listPeopleBase.filter((p) => p.name.toLowerCase().includes(trimmedSearch))

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div className="header-top-spacer" aria-hidden />
          <div className="lang-switcher lang-switcher--top-right">
            <button
              type="button"
              className="lang-switch-btn"
              onClick={() => setLocale(locale === 'en' ? 'vi' : 'en')}
              aria-label={t('app.language')}
              title={locale === 'en' ? 'Tiếng Việt' : 'English'}
            >
              <span className={`lang-switch-flag ${locale === 'en' ? 'lang-switch-flag--active' : ''}`} aria-hidden>🇺🇸</span>
              <span className={`lang-switch-flag ${locale === 'vi' ? 'lang-switch-flag--active' : ''}`} aria-hidden>🇻🇳</span>
            </button>
          </div>
        </div>
        <div className="header-main">
        <a href="#" className="logo" aria-label="FamiTree" onClick={(e) => { e.preventDefault(); setView('tree'); }}>
          <img src="/logo.png" alt="FamiTree" />
        </a>
        <div className="tagline-center">
          <p className="tagline">{t('app.tagline')}</p>
        </div>
        <div className="search-wrap">
          <label className="search-label" htmlFor="member-search">
            <span className="search-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </span>
            <input
              id="member-search"
              type="search"
              className="search-input"
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t('search.label')}
              autoComplete="off"
            />
          </label>
        </div>
        {isAdmin && (
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => setShowAddForm(true)}>
              {t('actions.addPerson')}
            </button>
          </div>
        )}
        <nav className="nav">
          <button
            className={view === 'tree' ? 'active' : ''}
            onClick={() => setView('tree')}
          >
            {t('nav.tree')}
          </button>
          <button
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
          >
            {t('nav.list')}
          </button>
          <div className="header-user-menu" ref={userMenuRef}>
            {isAdmin && (
              <input
                ref={restoreDbInputRef}
                type="file"
                accept=".sqlite,.db,application/x-sqlite3,application/vnd.sqlite3"
                className="hidden-input"
                aria-label={t('auth.restoreDatabase')}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  if (!confirm(t('auth.restoreDatabaseConfirm'))) return
                  try {
                    const buffer = await file.arrayBuffer()
                    await loadDatabaseFromBuffer(buffer)
                    if (hasServerDbApi()) window.location.reload()
                  } catch (err) {
                    const message = err instanceof Error ? err.message : String(err)
                    alert(message)
                  }
                }}
              />
            )}
            <button
              type="button"
              className={userMenuOpen ? 'active' : ''}
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
            >
              <span>{t('auth.system')}</span>
              <span className="nav-chevron" aria-hidden>{userMenuOpen ? '▴' : '▾'}</span>
            </button>
            {userMenuOpen && (
              <div className="header-user-dropdown" role="menu">
                <div className="header-user-dropdown-label">{t('auth.system')}</div>
                <div className="header-user-dropdown-list">
                    <button
                      type="button"
                      className="header-user-item"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false)
                        setView('summary')
                      }}
                    >
                      <span className="header-user-item-icon" aria-hidden>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="20" x2="18" y2="10" />
                          <line x1="12" y1="20" x2="12" y2="4" />
                          <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                      </span>
                      {t('summary.title')}
                    </button>
                    <button
                      type="button"
                      className="header-user-item"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false)
                        setView('reminders')
                      }}
                    >
                      <span className="header-user-item-icon" aria-hidden>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </span>
                      {t('reminders.menu')}
                    </button>
                  {isAdmin && (
                    <button
                      type="button"
                      className="header-user-item"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false)
                        if (confirm(t('auth.exportCsvConfirm'))) exportToCsv()
                      }}
                    >
                      <span className="header-user-item-icon" aria-hidden>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </span>
                      {t('auth.exportCsv')}
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <input
                        ref={importCsvInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden-input"
                        aria-label={t('auth.importCsv')}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) importFromCsv(file)
                          e.target.value = ''
                        }}
                      />
                      <button
                        type="button"
                        className="header-user-item"
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false)
                          if (confirm(t('auth.importCsvConfirm'))) importCsvInputRef.current?.click()
                        }}
                      >
                        <span className="header-user-item-icon" aria-hidden>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                        </span>
                        {t('auth.importCsv')}
                      </button>
                    </>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      className="header-user-item"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false)
                        if (!confirm(t('auth.saveDatabaseConfirm'))) return
                        const data = exportDatabase()
                        if (data) {
                          const blob = new Blob([data as BlobPart], { type: 'application/vnd.sqlite3' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `famitree-${new Date().toISOString().slice(0, 10)}.sqlite`
                          a.click()
                          URL.revokeObjectURL(url)
                        }
                      }}
                    >
                      <span className="header-user-item-icon" aria-hidden>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </span>
                      {t('auth.saveDatabase')}
                    </button>
                  )}
                  {isAdmin && (
                    <button
                        type="button"
                        className="header-user-item"
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false)
                          restoreDbInputRef.current?.click()
                        }}
                      >
                        <span className="header-user-item-icon" aria-hidden>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                        </span>
                        {t('auth.restoreDatabase')}
                      </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      className="header-user-item"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false)
                        setView('users')
                      }}
                    >
                      <span className="header-user-item-icon" aria-hidden>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </span>
                      {t('auth.manageUsers')}
                    </button>
                  )}
                  {isAdmin && <div className="header-user-dropdown-divider" aria-hidden />}
                  <button
                  type="button"
                  className="header-user-item"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false)
                    logout()
                  }}
                >
                  <span className="header-user-item-icon" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </span>
                  {t('auth.logout')}
                </button>
                </div>
              </div>
            )}
          </div>
        </nav>
        </div>
      </header>

      <main className="main">
        {view === 'users' && isAdmin && (
          <div className="users-screen">
            <h2 className="users-screen-title">{t('auth.manageUsers')}</h2>

            <div className="users-screen-toolbar">
              <label className="users-screen-search-label" htmlFor="user-search">
                <span className="search-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </span>
                <input
                  id="user-search"
                  type="search"
                  className="users-screen-search-input"
                  placeholder={t('auth.searchUsers')}
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  aria-label={t('auth.searchUsersLabel')}
                  autoComplete="off"
                />
              </label>
              <button type="button" className="btn primary users-screen-create-btn" onClick={() => { setShowUserForm(true); setUserFormError(null); setUserFormSuccess(false) }}>
                {t('auth.createUser')}
              </button>
            </div>

            <section className="users-screen-section users-screen-list">
              <div className="user-list-card">
                <table className="user-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('auth.username')}</th>
                      <th scope="col">{t('auth.lastUpdated')}</th>
                      <th scope="col">{t('auth.defaultBranch')}</th>
                      <th scope="col">{t('auth.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUserList.map((row) => (
                      <tr key={row.id} className="user-table-row">
                        <td className="user-table-cell user-table-cell--name">
                          <span className="user-list-name-row">
                            <span className="user-list-name">{row.username}</span>
                            {row.disabled && <span className="user-list-badge">{t('auth.disabled')}</span>}
                          </span>
                        </td>
                        <td className="user-table-cell user-table-cell--updated">
                          {row.updatedAt ? (
                            <span className="user-list-updated" title={new Date(row.updatedAt).toLocaleString()}>
                              {new Date(row.updatedAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="user-table-cell user-table-cell--branch">
                          {row.defaultBranchPersonId
                            ? (getPerson(row.defaultBranchPersonId)?.name ?? '—')
                            : t('tree.branchAll')}
                        </td>
                        <td className="user-table-cell user-table-cell--actions">
                          <div className="user-list-actions">
                            {row.username !== 'admin' && (
                              <button type="button" className="btn small" onClick={() => updateUserByAdmin(row.id, { disabled: !row.disabled }).then(() => refreshUserList())} title={row.disabled ? t('auth.enable') : t('auth.disable')}>
                                {row.disabled ? t('auth.enable') : t('auth.disable')}
                              </button>
                            )}
                            <button type="button" className="btn small" onClick={() => { setEditingUserId(row.id); setEditUsername(row.username); setEditPassword(''); setEditPasswordConfirm(''); setEditBranchId(row.defaultBranchPersonId ?? null); setEditError(null) }}>{t('auth.editUser')}</button>
                            {user.id !== row.id && (
                              <button type="button" className="btn small" onClick={() => { setDeleteConfirmUserId(row.id); setDeleteError(null) }}>{t('auth.removeUser')}</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {deleteConfirmUserId && (
                <div className="user-delete-confirm">
                  <p>{t('auth.removeUserConfirm', { name: userList.find((u) => u.id === deleteConfirmUserId)?.username ?? '' })}</p>
                  {deleteError && <p className="auth-error" role="alert">{deleteError}</p>}
                  {deleteConfirmUserId === user.id && (
                    <p className="auth-error" role="alert">{t('auth.cannotDeleteSelf')}</p>
                  )}
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn primary"
                      disabled={deleteConfirmUserId === user.id}
                      onClick={() => {
                        if (deleteConfirmUserId === user.id) return
                        try {
                          const err = deleteUserByAdmin(deleteConfirmUserId)
                          if (err.error) setDeleteError(err.error.startsWith('auth.') ? t(err.error) : err.error)
                          else { setDeleteConfirmUserId(null); setDeleteError(null); refreshUserList() }
                        } catch (e) {
                          setDeleteError(e instanceof Error ? e.message : String(e))
                        }
                      }}
                    >
                      {t('form.delete')}
                    </button>
                    <button type="button" className="btn" onClick={() => { setDeleteConfirmUserId(null); setDeleteError(null) }}>{t('form.cancel')}</button>
                  </div>
                </div>
              )}
            </section>

            {showUserForm && (
              <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-create-user-title" onClick={() => { setShowUserForm(false); setUserFormError(null); setNewUserUsername(''); setNewUserPassword(''); setNewUserPasswordConfirm(''); setNewUserBranchId(null) }}>
                <div className="modal-content modal-content--form" onClick={(e) => e.stopPropagation()}>
                  <h3 id="modal-create-user-title" className="modal-title">{t('auth.addNewUser')}</h3>
                  <form
                    className="user-form"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      setUserFormError(null)
                      setUserFormSuccess(false)
                      if (newUserPassword !== newUserPasswordConfirm) {
                        setUserFormError(t('auth.passwordMismatch'))
                        return
                      }
                      const result = await createUser(newUserUsername, newUserPassword, newUserBranchId ?? undefined)
                      if (result.error) {
                        setUserFormError(result.error.startsWith('auth.') ? t(result.error) : result.error)
                      } else {
                        setUserFormSuccess(true)
                        setNewUserUsername('')
                        setNewUserPassword('')
                        setNewUserPasswordConfirm('')
                        setNewUserBranchId(null)
                        refreshUserList()
                        setTimeout(() => { setShowUserForm(false); setUserFormSuccess(false) }, 1500)
                      }
                    }}
                  >
                    <div className="form-group">
                      <label htmlFor="new-user-username">{t('auth.newUserUsername')}</label>
                      <input
                        id="new-user-username"
                        type="text"
                        value={newUserUsername}
                        onChange={(e) => setNewUserUsername(e.target.value)}
                        required
                        minLength={1}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="new-user-password">{t('auth.newUserPassword')}</label>
                      <PasswordInput
                        id="new-user-password"
                        value={newUserPassword}
                        onChange={setNewUserPassword}
                        required
                        minLength={4}
                      />
                    </div>
                    {hasBranchSelector && (
                      <BranchCombobox
                        id="new-user-branch"
                        value={newUserBranchId}
                        onChange={setNewUserBranchId}
                        options={allMaleMembers}
                        label={t('auth.defaultBranch')}
                        searchPlaceholder={t('tree.branchSearchPlaceholder')}
                        allBranchesLabel={t('tree.branchAll')}
                      />
                    )}
                    <div className="form-group">
                      <label htmlFor="new-user-password-confirm">{t('auth.confirmPassword')}</label>
                      <PasswordInput
                        id="new-user-password-confirm"
                        value={newUserPasswordConfirm}
                        onChange={setNewUserPasswordConfirm}
                        required
                        minLength={4}
                      />
                    </div>
                    {userFormError && <p className="auth-error" role="alert">{userFormError}</p>}
                    {userFormSuccess && <p className="auth-success">{t('auth.userCreated')}</p>}
                    <div className="form-actions">
                      <button type="submit" className="btn primary">{t('auth.createUser')}</button>
                      <button type="button" className="btn" onClick={() => { setShowUserForm(false); setUserFormError(null); setNewUserUsername(''); setNewUserPassword(''); setNewUserPasswordConfirm(''); setNewUserBranchId(null) }}>
                        {t('form.cancel')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {editingUserId && (() => {
              const row = userList.find((u) => u.id === editingUserId)
              if (!row) return null
              return (
                <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-edit-user-title" onClick={() => { setEditingUserId(null); setEditError(null); setEditBranchId(null) }}>
                  <div className="modal-content modal-content--form" onClick={(e) => e.stopPropagation()}>
                    <h3 id="modal-edit-user-title" className="modal-title">{t('auth.updateUser')}</h3>
                    <form
                      className="user-form"
                      onSubmit={async (e) => {
                        e.preventDefault()
                        setEditError(null)
                        if (editPassword || editPasswordConfirm) {
                          if (editPassword !== editPasswordConfirm) {
                            setEditError(t('auth.passwordMismatch'))
                            return
                          }
                        }
                        const isEditingSelf = row.id === user.id
                        const result = await updateUserByAdmin(row.id, {
                          username: isEditingSelf ? undefined : (editUsername.trim() || undefined),
                          password: editPassword || undefined,
                          defaultBranchPersonId: editBranchId ?? undefined,
                        })
                        if (result.error) {
                          setEditError(result.error.startsWith('auth.') ? t(result.error) : result.error)
                        } else {
                          setEditingUserId(null)
                          setEditUsername('')
                          setEditPassword('')
                          setEditPasswordConfirm('')
                          setEditBranchId(null)
                          refreshUserList()
                        }
                      }}
                    >
                      <div className="form-group">
                        <label htmlFor="edit-username-modal">{t('auth.username')}</label>
                        <input
                          id="edit-username-modal"
                          type="text"
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          readOnly={row.id === user.id}
                          required
                          aria-readonly={row.id === user.id}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="edit-password-modal">{t('auth.newUserPassword')}</label>
                        <PasswordInput
                          id="edit-password-modal"
                          value={editPassword}
                          onChange={setEditPassword}
                          placeholder="••••••••"
                        />
                      </div>
                      {hasBranchSelector && (
                        <BranchCombobox
                          id="edit-branch-modal"
                          value={editBranchId}
                          onChange={setEditBranchId}
                          options={allMaleMembers}
                          label={t('auth.defaultBranch')}
                          searchPlaceholder={t('tree.branchSearchPlaceholder')}
                          allBranchesLabel={t('tree.branchAll')}
                        />
                      )}
                      <div className="form-group">
                        <label htmlFor="edit-password-confirm-modal">{t('auth.confirmPassword')}</label>
                        <PasswordInput
                          id="edit-password-confirm-modal"
                          value={editPasswordConfirm}
                          onChange={setEditPasswordConfirm}
                          placeholder="••••••••"
                        />
                      </div>
                      {editError && <p className="auth-error" role="alert">{editError}</p>}
                      <div className="form-actions">
                        <button type="submit" className="btn primary">{t('form.save')}</button>
                        <button type="button" className="btn" onClick={() => { setEditingUserId(null); setEditError(null); setEditBranchId(null) }}>
                          {t('form.cancel')}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
        {view === 'tree' && (
          <div className="tree-panel">
            {treeNodes.length === 0 ? (
              <div className="empty-state">
                <p>{t('tree.empty')}</p>
                {isAdmin && (
                  <button type="button" className="btn primary" onClick={() => setShowAddForm(true)}>
                    {t('tree.addFirst')}
                  </button>
                )}
              </div>
            ) : filteredTreeNodes.length === 0 ? (
              <div className="empty-state">
                <p>{t('tree.noMatches', { query: searchQuery.trim() })}</p>
              </div>
            ) : (
              <>
                <h1 className="tree-print-title" aria-hidden>{t('tree.printTitle')}</h1>
                <div className="tree-panel-actions tree-panel-actions--no-print">
                  {hasBranchSelector && (
                    <div className="tree-branch-combobox" ref={branchDropdownRef}>
                      <span className="tree-branch-label-text">{t('tree.branchLabel')}</span>
                      <div className="tree-branch-trigger-wrap">
                        <button
                          type="button"
                          className="tree-branch-select tree-branch-trigger"
                          onClick={() => setBranchDropdownOpen((o) => !o)}
                          aria-expanded={branchDropdownOpen}
                          aria-haspopup="listbox"
                          aria-label={t('tree.branchLabel')}
                        >
                          {selectedBranchValid && selectedBranchId
                            ? selectedBranchDisplayLabel
                            : t('tree.branchAll')}
                          <span className="tree-branch-chevron" aria-hidden>{branchDropdownOpen ? '▴' : '▾'}</span>
                        </button>
                        {branchDropdownOpen && (
                          <div className="tree-branch-dropdown" role="listbox">
                            <input
                              type="search"
                              className="tree-branch-search"
                              placeholder={t('tree.branchSearchPlaceholder')}
                              value={branchSearchQuery}
                              onChange={(e) => setBranchSearchQuery(e.target.value)}
                              onKeyDown={(e) => e.stopPropagation()}
                              autoFocus
                              aria-label={t('tree.branchSearchPlaceholder')}
                            />
                            <ul className="tree-branch-list">
                              <li>
                                <button
                                  type="button"
                                  className={`tree-branch-option ${!selectedBranchValid || selectedBranchId === null ? 'tree-branch-option--selected' : ''}`}
                                  role="option"
                                  aria-selected={!selectedBranchValid || selectedBranchId === null}
                                  onClick={() => {
                                    setSelectedBranchId(null)
                                    setBranchDropdownOpen(false)
                                    setBranchSearchQuery('')
                                  }}
                                >
                                  {t('tree.branchAll')}
                                </button>
                              </li>
                              {filteredBranchMembers.map((person) => (
                                <li key={person.id}>
                                  <button
                                    type="button"
                                    className={`tree-branch-option ${selectedBranchId === person.id ? 'tree-branch-option--selected' : ''}`}
                                    role="option"
                                    aria-selected={selectedBranchId === person.id}
                                    onClick={() => {
                                      setSelectedBranchId(person.id)
                                      setBranchDropdownOpen(false)
                                      setBranchSearchQuery('')
                                    }}
                                  >
                                    {person.name}
                                  </button>
                                </li>
                              ))}
                              {filteredBranchMembers.length === 0 && (
                                <li className="tree-branch-empty">{t('tree.noMatches', { query: branchSearchQuery.trim() })}</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const prevTitle = document.title
                      document.title = t('tree.printTitle')
                      window.print()
                      const restore = () => {
                        document.title = prevTitle
                        window.removeEventListener('afterprint', restore)
                      }
                      window.addEventListener('afterprint', restore)
                    }}
                    aria-label={t('tree.print')}
                  >
                    <span className="tree-print-icon" aria-hidden>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      </svg>
                    </span>
                    {t('tree.print')}
                  </button>
                </div>
                <TreeView
                  nodes={filteredTreeNodes}
                  mainPersonIds={getMainPersonIds(filteredTreeNodes)}
                  selectedId={selectedPerson?.id}
                  onSelect={setSelectedPerson}
                  t={t}
                />
              </>
            )}
          </div>
        )}
        {view === 'list' && (
          <div className="list-panel-wrap">
            {hasBranchSelector && (
              <div className="list-branch-filter">
                <div className="tree-branch-combobox" ref={branchDropdownRef}>
                  <span className="tree-branch-label-text">{t('tree.branchLabel')}</span>
                  <div className="tree-branch-trigger-wrap">
                    <button
                      type="button"
                      className="tree-branch-select tree-branch-trigger"
                      onClick={() => setBranchDropdownOpen((o) => !o)}
                      aria-expanded={branchDropdownOpen}
                      aria-haspopup="listbox"
                      aria-label={t('tree.branchLabel')}
                    >
                      {selectedBranchValid && selectedBranchId
                        ? selectedBranchDisplayLabel
                        : t('tree.branchAll')}
                      <span className="tree-branch-chevron" aria-hidden>{branchDropdownOpen ? '▴' : '▾'}</span>
                    </button>
                    {branchDropdownOpen && (
                      <div className="tree-branch-dropdown" role="listbox">
                        <input
                          type="search"
                          className="tree-branch-search"
                          placeholder={t('tree.branchSearchPlaceholder')}
                          value={branchSearchQuery}
                          onChange={(e) => setBranchSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          autoFocus
                          aria-label={t('tree.branchSearchPlaceholder')}
                        />
                        <ul className="tree-branch-list">
                          <li>
                            <button
                              type="button"
                              className={`tree-branch-option ${!selectedBranchValid || selectedBranchId === null ? 'tree-branch-option--selected' : ''}`}
                              role="option"
                              aria-selected={!selectedBranchValid || selectedBranchId === null}
                              onClick={() => {
                                setSelectedBranchId(null)
                                setBranchDropdownOpen(false)
                                setBranchSearchQuery('')
                              }}
                            >
                              {t('tree.branchAll')}
                            </button>
                          </li>
                          {filteredBranchMembers.map((person) => (
                            <li key={person.id}>
                              <button
                                type="button"
                                className={`tree-branch-option ${selectedBranchId === person.id ? 'tree-branch-option--selected' : ''}`}
                                role="option"
                                aria-selected={selectedBranchId === person.id}
                                onClick={() => {
                                  setSelectedBranchId(person.id)
                                  setBranchDropdownOpen(false)
                                  setBranchSearchQuery('')
                                }}
                              >
                                {person.name}
                              </button>
                            </li>
                          ))}
                          {filteredBranchMembers.length === 0 && (
                            <li className="tree-branch-empty">{t('tree.noMatches', { query: branchSearchQuery.trim() })}</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <PersonList
              people={filteredPeople}
              searchQuery={trimmedSearch}
              onSelect={setSelectedPerson}
              selectedId={selectedPerson?.id}
            />
          </div>
        )}
        {view === 'summary' && (
          <div className="summary-panel">
            <TreeSummary
              selectedBranchId={selectedBranchId}
              onBranchChange={hasBranchSelector ? setSelectedBranchId : undefined}
              branchOptions={hasBranchSelector ? allMaleMembers : []}
              showBranchFilter={hasBranchSelector}
            />
          </div>
        )}
        {view === 'reminders' && (
          <div className="reminders-panel">
            <RemindersView initialBranchId={user?.defaultBranchPersonId ?? null} />
          </div>
        )}

        {view !== 'users' && view !== 'summary' && view !== 'reminders' && (
        <aside className="sidebar" ref={sidebarRef}>
          {!isAdmin && selectedPerson && (
            <div className="sidebar-placeholder">
              <p>{t('auth.viewOnly')}</p>
            </div>
          )}
          {(!selectedPerson || isAdmin) && (
            <>
              <TreeSummary />
              {state.people.length > 0 && !selectedPerson && (
                <div className="sidebar-placeholder">
                  <p>{t('sidebar.selectPerson')}</p>
                </div>
              )}
            </>
          )}
        </aside>
        )}

        {isAdmin && (showAddForm || selectedPerson) && (
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="person-form-title"
            onClick={() => {
              setShowAddForm(false)
              setSelectedPerson(null)
            }}
          >
            <div className="modal-content modal-content--person-form" onClick={(e) => e.stopPropagation()}>
              <PersonForm
                person={showAddForm ? undefined : selectedPerson ?? undefined}
                onClose={() => {
                  setShowAddForm(false)
                  setSelectedPerson(null)
                }}
                onSaved={() => {
                  setShowAddForm(false)
                  setSelectedPerson(null)
                }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
