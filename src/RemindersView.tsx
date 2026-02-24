import { useState, useEffect, useRef } from 'react'
import { getState, getChildrenIds } from './store'
import { useLocale } from './LocaleContext'
import { getNextOccurrence, formatMonthDay, getCurrentAge } from './dateUtils'
import { getPersonIdsInBranch } from './treeUtils'
import type { Person } from './types'

type TFunction = (key: string, params?: Record<string, string | number>) => string

interface UpcomingItem {
  person: Person
  daysUntil: number
  nextDate: Date
}

function getUpcomingBirthdays(people: Person[], limit: number): UpcomingItem[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const items: UpcomingItem[] = []
  for (const p of people) {
    if (!p.birthDate?.trim()) continue
    if (p.deathDate?.trim()) continue /* only people still alive */
    const next = getNextOccurrence(p.birthDate, today)
    if (!next) continue
    items.push({ person: p, daysUntil: next.daysUntil, nextDate: next.date })
  }
  items.sort((a, b) => a.daysUntil - b.daysUntil)
  return items.slice(0, limit)
}

function getUpcomingDeathAnniversaries(people: Person[], limit: number): UpcomingItem[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const items: UpcomingItem[] = []
  for (const p of people) {
    if (!p.deathDate?.trim()) continue
    const next = getNextOccurrence(p.deathDate, today)
    if (!next) continue
    items.push({ person: p, daysUntil: next.daysUntil, nextDate: next.date })
  }
  items.sort((a, b) => a.daysUntil - b.daysUntil)
  return items.slice(0, limit)
}

function formatDaysUntil(days: number, t: TFunction): string {
  if (days === 0) return t('reminders.today')
  if (days === 1) return t('reminders.tomorrow')
  return t('reminders.daysUntil', { count: days })
}

function getAgeAtNextBirthday(birthDate: string, nextDate: Date): number {
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return 0
  return nextDate.getFullYear() - birth.getFullYear()
}

interface RemindersViewProps {
  /** Default branch (person id) for the logged-in user; used as initial filter. */
  initialBranchId?: string | null
}

export function RemindersView({ initialBranchId = null }: RemindersViewProps) {
  const { t, locale } = useLocale()
  const state = getState()
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(initialBranchId ?? null)
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false)
  useEffect(() => {
    setSelectedBranchId(initialBranchId ?? null)
  }, [initialBranchId])
  const [branchSearchQuery, setBranchSearchQuery] = useState('')
  const branchDropdownRef = useRef<HTMLDivElement>(null)

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

  const branchOptions = state.people
    .filter((p) => {
      if (p.gender !== 'male') return false
      if (p.deathDate?.trim()) return true
      const hasChildren = getChildrenIds(p.id).length > 0
      const age = getCurrentAge(p.birthDate, p.deathDate)
      return hasChildren && age !== null && age > 60
    })
    .sort((a, b) => a.name.localeCompare(b.name, locale))

  const peopleToShow =
    selectedBranchId == null
      ? state.people
      : state.people.filter((p) => getPersonIdsInBranch(selectedBranchId).has(p.id))

  const limit = 30
  const birthdays = getUpcomingBirthdays(peopleToShow, limit)
  const anniversaries = getUpcomingDeathAnniversaries(peopleToShow, limit)
  const hasBranchFilter = branchOptions.length >= 1
  const branchSearchLower = branchSearchQuery.trim().toLowerCase()
  const filteredBranchOptions =
    branchSearchLower === ''
      ? branchOptions
      : branchOptions.filter((p) => p.name.toLowerCase().includes(branchSearchLower))
  const selectedBranchPerson = selectedBranchId ? branchOptions.find((p) => p.id === selectedBranchId) : null

  return (
    <div className="reminders-screen">
      <h2 className="reminders-screen-title">{t('reminders.title')}</h2>

      {hasBranchFilter && (
        <div className="reminders-branch-filter">
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
                {selectedBranchPerson ? selectedBranchPerson.name : t('tree.branchAll')}
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
                        className={`tree-branch-option ${selectedBranchId === null ? 'tree-branch-option--selected' : ''}`}
                        role="option"
                        aria-selected={selectedBranchId === null}
                        onClick={() => {
                          setSelectedBranchId(null)
                          setBranchDropdownOpen(false)
                          setBranchSearchQuery('')
                        }}
                      >
                        {t('tree.branchAll')}
                      </button>
                    </li>
                    {filteredBranchOptions.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={`tree-branch-option ${selectedBranchId === p.id ? 'tree-branch-option--selected' : ''}`}
                          role="option"
                          aria-selected={selectedBranchId === p.id}
                          onClick={() => {
                            setSelectedBranchId(p.id)
                            setBranchDropdownOpen(false)
                            setBranchSearchQuery('')
                          }}
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                    {filteredBranchOptions.length === 0 && (
                      <li className="tree-branch-empty">{t('tree.noMatches', { query: branchSearchQuery.trim() })}</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="reminders-columns">
        <section className="reminders-section">
          <h3 className="reminders-section-title">{t('reminders.birthdaysSection')}</h3>
          {birthdays.length === 0 ? (
            <p className="reminders-empty">{t('reminders.emptyBirthdays')}</p>
          ) : (
            <ul className="reminders-list" role="list">
              {birthdays.map(({ person, daysUntil }) => (
                <li key={person.id} className="reminders-item">
                  <span className="reminders-item-name">{person.name}</span>
                  <span className="reminders-item-date" aria-hidden>
                    {formatMonthDay(person.birthDate!)}
                  </span>
                  <span className="reminders-item-meta">
                    {formatDaysUntil(daysUntil, t)}
                    {person.birthDate && (
                      <>
                        {' · '}
                        {t('reminders.turnsAge', {
                          age: getAgeAtNextBirthday(
                            person.birthDate,
                            getNextOccurrence(person.birthDate)!.date
                          ),
                        })}
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="reminders-section">
          <h3 className="reminders-section-title">{t('reminders.deathAnniversariesSection')}</h3>
          {anniversaries.length === 0 ? (
            <p className="reminders-empty">{t('reminders.emptyAnniversaries')}</p>
          ) : (
            <ul className="reminders-list" role="list">
              {anniversaries.map(({ person, daysUntil }) => (
                <li key={person.id} className="reminders-item">
                  <span className="reminders-item-name">{person.name}</span>
                  <span className="reminders-item-date" aria-hidden>
                    {formatMonthDay(person.deathDate!)}
                  </span>
                  <span className="reminders-item-meta">{formatDaysUntil(daysUntil, t)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
