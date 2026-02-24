import { useState, useRef, useEffect } from 'react'

export interface BranchOption {
  id: string
  name: string
}

interface BranchComboboxProps {
  value: string | null
  onChange: (id: string | null) => void
  options: BranchOption[]
  label: string
  searchPlaceholder: string
  allBranchesLabel: string
  id?: string
  /** When true, renders inline (label + combobox) without form-group wrapper. For right-aligned summary filter. */
  inline?: boolean
}

export function BranchCombobox({
  value,
  onChange,
  options,
  label,
  searchPlaceholder,
  allBranchesLabel,
  id,
  inline = false,
}: BranchComboboxProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  const searchLower = searchQuery.trim().toLowerCase()
  const filtered =
    searchLower === ''
      ? options
      : options.filter((p) => p.name.toLowerCase().includes(searchLower))
  const selectedOption = value ? options.find((p) => p.id === value) : null
  const displayLabel = selectedOption ? selectedOption.name : allBranchesLabel

  const content = (
    <>
      {inline ? (
        <span className="tree-branch-label-text" id={id ? `${id}-label` : undefined}>{label}</span>
      ) : (
        <label id={id ? `${id}-label` : undefined}>{label}</label>
      )}
      <div className="tree-branch-combobox form-branch-combobox" ref={ref}>
        <div className="tree-branch-trigger-wrap">
          <button
            type="button"
            id={id}
            className="tree-branch-select tree-branch-trigger"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={label}
          >
            {displayLabel}
            <span className="tree-branch-chevron" aria-hidden>{open ? '▴' : '▾'}</span>
          </button>
          {open && (
            <div className="tree-branch-dropdown" role="listbox">
              <input
                type="search"
                className="tree-branch-search"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                autoFocus
                aria-label={searchPlaceholder}
              />
              <ul className="tree-branch-list">
                <li>
                  <button
                    type="button"
                    className={`tree-branch-option ${value === null ? 'tree-branch-option--selected' : ''}`}
                    role="option"
                    aria-selected={value === null}
                    onClick={() => {
                      onChange(null)
                      setOpen(false)
                      setSearchQuery('')
                    }}
                  >
                    {allBranchesLabel}
                  </button>
                </li>
                {filtered.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`tree-branch-option ${value === p.id ? 'tree-branch-option--selected' : ''}`}
                      role="option"
                      aria-selected={value === p.id}
                      onClick={() => {
                        onChange(p.id)
                        setOpen(false)
                        setSearchQuery('')
                      }}
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="tree-branch-empty">{searchQuery.trim() ? '—' : ''}</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  )

  return inline ? (
    <div className="tree-branch-combobox-inline">{content}</div>
  ) : (
    <div className="form-group">{content}</div>
  )
}
