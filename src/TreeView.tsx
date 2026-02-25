import type React from 'react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { TreeNode } from './types'
import type { Person } from './types'
import { Avatar } from './Avatar'
import { formatDateDisplay, getCurrentAge } from './dateUtils'

/** Compute age (uses same logic as dateUtils for partial dates). */
function getAge(birthDate?: string, deathDate?: string): number | null {
  return getCurrentAge(birthDate, deathDate)
}

/** Format date line for tree: always show age (years old) when birth date exists. */
function formatDateLine(
  birthDate?: string,
  deathDate?: string,
  ageUnit: string = 'years'
): string {
  const hasBirth = !!birthDate?.trim()
  const hasDeath = !!deathDate?.trim()
  const age = hasBirth ? getAge(birthDate, deathDate) : null
  const ageSuffix = age !== null ? ` (${age} ${ageUnit})` : ''
  if (hasBirth && hasDeath) return [formatDateDisplay(birthDate), formatDateDisplay(deathDate)].join(' – ') + ageSuffix
  if (hasBirth) return ageSuffix ? `${formatDateDisplay(birthDate)}${ageSuffix}` : formatDateDisplay(birthDate)
  if (hasDeath) return formatDateDisplay(deathDate)
  return ''
}

/** Same as formatDateLine but returns JSX with age (and unit) in bold for display. Exported for list cards. */
export function formatDateLineWithBoldAge(
  birthDate?: string,
  deathDate?: string,
  ageUnit: string = 'years'
): React.ReactNode {
  const hasBirth = !!birthDate?.trim()
  const hasDeath = !!deathDate?.trim()
  const age = hasBirth ? getAge(birthDate, deathDate) : null
  if (hasBirth && hasDeath) {
    const range = [formatDateDisplay(birthDate), formatDateDisplay(deathDate)].join(' – ')
    return age !== null ? <>{range} <strong>({age} {ageUnit})</strong></> : range
  }
  if (hasBirth) {
    if (age !== null) {
      return (
        <>
          {formatDateDisplay(birthDate)} <strong>({age} {ageUnit})</strong>
        </>
      )
    }
    return formatDateDisplay(birthDate)
  }
  if (hasDeath) return formatDateDisplay(deathDate)
  return null
}

type TFunction = (key: string, params?: Record<string, string | number>) => string

type NodeRole = 'root' | 'child'

function getPersonTitleKey(role: NodeRole, gender?: string): string {
  if (role === 'root') {
    if (gender === 'male') return 'treeView.father'
    if (gender === 'female') return 'treeView.mother'
    return 'treeView.parent'
  }
  if (role === 'child') {
    if (gender === 'male') return 'treeView.son'
    if (gender === 'female') return 'treeView.daughter'
    return 'treeView.child'
  }
  return 'treeView.parent'
}

/** Title key for spouse; use index (1-based) for "Vợ thứ 2" when multiple. Exported for list cards. */
export function getSpouseTitleKey(spouse: Person, index: number): { key: string; params?: Record<string, number> } {
  if (spouse.memberRole === 'daughter-in-law') return { key: 'treeView.daughterInLaw' }
  if (spouse.memberRole === 'son-in-law') return { key: 'treeView.sonInLaw' }
  if (spouse.gender === 'male') return index > 1 ? { key: 'treeView.husbandN', params: { n: index } } : { key: 'treeView.husband' }
  if (spouse.gender === 'female') return index > 1 ? { key: 'treeView.wifeN', params: { n: index } } : { key: 'treeView.wife' }
  return index > 1 ? { key: 'treeView.spouseLabel' } : { key: 'treeView.spouseLabel' }
}

interface TreeViewProps {
  nodes: TreeNode[]
  mainPersonIds: Set<string>
  selectedId?: string
  onSelect: (person: Person | null) => void
  /** Double-click: show tree focused on this person (and their relationships). */
  onDoubleClick?: (person: Person) => void
  t: TFunction
  /** When set, show these ancestor generations above the tree (focus view). */
  ancestorLevels?: Person[][] | null
}

export function TreeView({ nodes, mainPersonIds, selectedId, onSelect, onDoubleClick, t, ancestorLevels }: TreeViewProps) {
  const [notesPopover, setNotesPopover] = useState<{
    notes: string
    rect: { left: number; top: number; width: number; height: number }
  } | null>(null)

  return (
    <div className="tree-view">
      {ancestorLevels && ancestorLevels.length > 0 && (
        <div className="tree-ancestors" aria-label={t('treeView.previousGenerations')}>
          <p className="tree-ancestors-title">{t('treeView.previousGenerations')}</p>
          {ancestorLevels.map((level, i) => (
            <div key={i} className="tree-ancestors-level">
              {level.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`tree-ancestor-chip ${p.id === selectedId ? 'selected' : ''}`}
                  onClick={() => onSelect(p)}
                  onDoubleClick={() => onDoubleClick?.(p)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {nodes.map((node) => (
        <TreeNodeComponent
          key={node.person.id}
          node={node}
          role="root"
          level={1}
          mainPersonIds={mainPersonIds}
          selectedId={selectedId}
          onSelect={onSelect}
          onDoubleClick={onDoubleClick}
          t={t}
          onNotesShow={(notes, rect) => setNotesPopover({ notes, rect })}
          onNotesHide={() => setNotesPopover(null)}
        />
      ))}
      {notesPopover &&
        createPortal(
          <div
            className="hover-notes-dialog hover-notes-dialog--portal"
            role="tooltip"
            aria-label={t('form.notes')}
            style={{
              position: 'fixed',
              left: notesPopover.rect.left + notesPopover.rect.width / 2,
              top: notesPopover.rect.top + notesPopover.rect.height + 8,
              transform: 'translateX(-50%)',
            }}
          >
            <p className="hover-notes-dialog-title">{t('form.notes')}</p>
            <p className="hover-notes-dialog-body">{notesPopover.notes}</p>
          </div>,
          document.body
        )}
    </div>
  )
}

function TreeNodeComponent({
  node,
  role,
  level,
  grandchildLabel,
  mainPersonIds,
  selectedId,
  onSelect,
  onDoubleClick,
  t,
  onNotesShow,
  onNotesHide,
}: {
  node: TreeNode
  role: NodeRole
  level: number
  /** When set, this node is shown as grandchild (cháu nội / cháu ngoại) from parent's gender. */
  grandchildLabel?: 'paternal' | 'maternal'
  mainPersonIds: Set<string>
  selectedId?: string
  onSelect: (person: Person | null) => void
  onDoubleClick?: (person: Person) => void
  t: TFunction
  onNotesShow?: (notes: string, rect: DOMRect) => void
  onNotesHide?: () => void
}) {
  const isSelected = node.person.id === selectedId
  const spouses = node.spouses ?? (node.spouse ? [node.spouse] : [])
  const hasSpouses = spouses.length > 0
  const hasChildren = node.children.length > 0
  const ageUnit = t('treeView.yearsOld')
  const grandchildTitleKey = grandchildLabel ? (grandchildLabel === 'paternal' ? 'treeView.paternalGrandchild' : 'treeView.maternalGrandchild') : null
  const personTitleKey = grandchildTitleKey ?? getPersonTitleKey(role, node.person.gender)
  const datesPersonContent = formatDateLineWithBoldAge(node.person.birthDate, node.person.deathDate, ageUnit)

  return (
    <div className="tree-node tree-node--horizontal">
      <div className="tree-row">
        <div className="tree-couple">
          <div
            className={`tree-node-card ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(node.person)}
            onDoubleClick={() => onDoubleClick?.(node.person)}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`${node.person.name}`}
            onMouseEnter={
              node.person.notes?.trim()
                ? (e) => onNotesShow?.(node.person.notes!.trim(), e.currentTarget.getBoundingClientRect())
                : undefined
            }
            onMouseLeave={node.person.notes?.trim() ? onNotesHide : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(node.person)
              }
            }}
          >
            <span className="tree-node-level" aria-hidden>{t('treeView.generationLevel', { n: level })}</span>
            <Avatar name={node.person.name} avatar={node.person.avatar} gender={node.person.gender} className="tree-node-avatar" />
            <p className="tree-node-title">{node.person.title?.trim() ? node.person.title.trim() : t(personTitleKey)}</p>
            <p className="name">{node.person.name}</p>
            {datesPersonContent != null && <p className="dates">{datesPersonContent}</p>}
          </div>
          {hasSpouses && spouses.map((spouse, i) => {
            const index = i + 1
            const spouseShownElsewhere = mainPersonIds.has(spouse.id)
            const { key: spouseTitleKey, params } = getSpouseTitleKey(spouse, index)
            const datesSpouseText = formatDateLine(spouse.birthDate, spouse.deathDate, ageUnit)
            const datesSpouseContent = formatDateLineWithBoldAge(spouse.birthDate, spouse.deathDate, ageUnit)
            return (
              <span key={spouse.id} style={{ display: 'contents' }}>
                <span className="spouse-connector" aria-hidden>&</span>
                {spouseShownElsewhere ? (
                  <div
                    className="tree-spouse-ref-wrap"
                    onMouseEnter={
                      spouse.notes?.trim()
                        ? (e) => onNotesShow?.(spouse.notes!.trim(), e.currentTarget.getBoundingClientRect())
                        : undefined
                    }
                    onMouseLeave={spouse.notes?.trim() ? onNotesHide : undefined}
                  >
                    <button
                      type="button"
                      className={`tree-spouse-ref ${spouse.id === selectedId ? 'selected' : ''}`}
                      onClick={() => onSelect(spouse)}
                      onDoubleClick={() => onDoubleClick?.(spouse)}
                      aria-label={t('treeView.spouse', { name: spouse.name })}
                    >
                      {t(spouseTitleKey, params)}: {spouse.name}
                    </button>
                  </div>
                ) : (
                  <div
                    className={`tree-node-card ${spouse.id === selectedId ? 'selected' : ''}`}
                    onClick={() => onSelect(spouse)}
                    onDoubleClick={() => onDoubleClick?.(spouse)}
                    role="button"
                    tabIndex={0}
                    aria-pressed={spouse.id === selectedId}
                    aria-label={`${spouse.name}${datesSpouseText ? `, ${datesSpouseText}` : ''}`}
                    onMouseEnter={
                      spouse.notes?.trim()
                        ? (e) => onNotesShow?.(spouse.notes!.trim(), e.currentTarget.getBoundingClientRect())
                        : undefined
                    }
                    onMouseLeave={spouse.notes?.trim() ? onNotesHide : undefined}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect(spouse)
                      }
                    }}
                  >
                    <Avatar name={spouse.name} avatar={spouse.avatar} gender={spouse.gender} className="tree-node-avatar" />
                    <p className="tree-node-title">{spouse.title?.trim() ? spouse.title.trim() : t(spouseTitleKey, params)}</p>
                    <p className="name">{spouse.name}</p>
                    {datesSpouseContent != null && <p className="dates">{datesSpouseContent}</p>}
                  </div>
                )}
              </span>
            )
          })}
        </div>
      </div>
      {hasChildren && (
        <>
          <div className="tree-node-connector" aria-hidden />
          <div className="tree-children">
            {node.children.map((child) => (
              <TreeNodeComponent
                key={child.person.id}
                node={child}
                role="child"
                level={level + 1}
                grandchildLabel={role === 'child' ? (node.person.gender === 'male' ? 'paternal' : node.person.gender === 'female' ? 'maternal' : undefined) : undefined}
                mainPersonIds={mainPersonIds}
                selectedId={selectedId}
                onSelect={onSelect}
                onDoubleClick={onDoubleClick}
                t={t}
                onNotesShow={onNotesShow}
                onNotesHide={onNotesHide}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
