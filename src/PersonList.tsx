import type { Person } from './types'
import { Avatar } from './Avatar'
import { formatDateDisplay } from './dateUtils'
import { useLocale } from './LocaleContext'

interface PersonListProps {
  people: Person[]
  searchQuery?: string
  selectedId?: string
  onSelect: (person: Person) => void
}

export function PersonList({ people, searchQuery, selectedId, onSelect }: PersonListProps) {
  const { t } = useLocale()

  if (people.length === 0) {
    return (
      <div className="list-panel">
        <p className="empty-state">
          {searchQuery ? t('list.noMatches', { query: searchQuery }) : t('list.empty')}
        </p>
      </div>
    )
  }

  return (
    <div className="list-panel">
      <p className="section-title">
        {searchQuery ? t('list.matches', { n: people.length }) : t('list.allMembers', { n: people.length })}
      </p>
      <div className="person-list">
        {people.map((p) => (
          <div
            key={p.id}
            className={`person-card ${p.id === selectedId ? 'selected' : ''}`}
            onClick={() => onSelect(p)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(p)
              }
            }}
          >
            <Avatar name={p.name} avatar={p.avatar} gender={p.gender} className="person-card-avatar" />
            <p className="name">{p.name}</p>
            <p className="meta">
              {[p.birthDate, p.deathDate].filter(Boolean).map(formatDateDisplay).join(' – ') || t('list.noDates')}
              {p.gender && ` · ${t('gender.' + p.gender)}`}
              {p.buriedAt && ` · ${t('form.buriedAt')}: ${p.buriedAt}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
