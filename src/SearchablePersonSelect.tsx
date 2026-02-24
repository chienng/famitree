import { useState, useRef, useEffect } from 'react'
import type { Person } from './types'

interface SearchablePersonSelectProps {
  options: Person[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  noMatchesLabel?: string
  id?: string
}

export function SearchablePersonSelect({
  options,
  value,
  onChange,
  placeholder = 'Select person…',
  searchPlaceholder = 'Search…',
  emptyLabel = 'No options',
  noMatchesLabel = 'No matches',
  id,
}: SearchablePersonSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.id === value)
  const filtered = !search.trim()
    ? options
    : options.filter((p) => p.name.toLowerCase().includes(search.toLowerCase().trim()))

  useEffect(() => {
    if (!open) return
    setSearch('')
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  return (
    <div className="searchable-person-select" ref={containerRef}>
      <button
        type="button"
        id={id}
        className="searchable-person-select__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={placeholder}
      >
        <span className="searchable-person-select__trigger-text">
          {selected ? selected.name : placeholder}
        </span>
        <span className="searchable-person-select__chevron" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <div className="searchable-person-select__dropdown" role="listbox">
          <div className="searchable-person-select__search-wrap">
            <input
              ref={inputRef}
              type="text"
              className="searchable-person-select__search"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label={searchPlaceholder}
            />
          </div>
          <ul className="searchable-person-select__list">
            {filtered.length === 0 ? (
              <li className="searchable-person-select__list-empty">{search.trim() ? noMatchesLabel : emptyLabel}</li>
            ) : (
              filtered.map((p) => (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={value === p.id}
                  className="searchable-person-select__option"
                  onClick={() => {
                    onChange(p.id)
                    setOpen(false)
                  }}
                >
                  {p.name}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
