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

/** Same as formatDateLine but returns JSX with age (and unit) in bold for display. */
function formatDateLineWithBoldAge(
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

function getSpouseTitleKey(gender?: string): string {
  if (gender === 'male') return 'treeView.husband'
  if (gender === 'female') return 'treeView.wife'
  return 'treeView.spouseLabel'
}

interface TreeViewProps {
  nodes: TreeNode[]
  mainPersonIds: Set<string>
  selectedId?: string
  onSelect: (person: Person | null) => void
  t: TFunction
}

export function TreeView({ nodes, mainPersonIds, selectedId, onSelect, t }: TreeViewProps) {
  const [notesPopover, setNotesPopover] = useState<{
    notes: string
    rect: { left: number; top: number; width: number; height: number }
  } | null>(null)

  return (
    <div className="tree-view">
      {nodes.map((node) => (
        <TreeNodeComponent
          key={node.person.id}
          node={node}
          role="root"
          mainPersonIds={mainPersonIds}
          selectedId={selectedId}
          onSelect={onSelect}
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
  mainPersonIds,
  selectedId,
  onSelect,
  t,
  onNotesShow,
  onNotesHide,
}: {
  node: TreeNode
  role: NodeRole
  mainPersonIds: Set<string>
  selectedId?: string
  onSelect: (person: Person | null) => void
  t: TFunction
  onNotesShow?: (notes: string, rect: DOMRect) => void
  onNotesHide?: () => void
}) {
  const isSelected = node.person.id === selectedId
  const hasSpouse = !!node.spouse
  const spouseShownElsewhere = node.spouse && mainPersonIds.has(node.spouse.id)
  const hasChildren = node.children.length > 0
  const ageUnit = t('treeView.yearsOld')
  const personTitleKey = getPersonTitleKey(role, node.person.gender)
  const spouseTitleKey = getSpouseTitleKey(node.spouse?.gender)

  const datesPersonText = formatDateLine(node.person.birthDate, node.person.deathDate, ageUnit)
  const datesSpouseText = node.spouse
    ? formatDateLine(node.spouse.birthDate, node.spouse.deathDate, ageUnit)
    : ''
  const datesPersonContent = formatDateLineWithBoldAge(node.person.birthDate, node.person.deathDate, ageUnit)
  const datesSpouseContent = node.spouse
    ? formatDateLineWithBoldAge(node.spouse.birthDate, node.spouse.deathDate, ageUnit)
    : null

  return (
    <div className="tree-node tree-node--horizontal">
      <div className="tree-row">
        <div className="tree-couple">
          <div
            className={`tree-node-card ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(node.person)}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`${node.person.name}${datesPersonText ? `, ${datesPersonText}` : ''}`}
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
            <Avatar name={node.person.name} avatar={node.person.avatar} gender={node.person.gender} className="tree-node-avatar" />
            <p className="tree-node-title">{node.person.title?.trim() ? node.person.title.trim() : t(personTitleKey)}</p>
            <p className="name">{node.person.name}</p>
            {datesPersonContent != null && <p className="dates">{datesPersonContent}</p>}
          </div>
          {hasSpouse && node.spouse && (
            <>
              <span className="spouse-connector" aria-hidden>&</span>
              {spouseShownElsewhere ? (
                <div
                  className="tree-spouse-ref-wrap"
                  onMouseEnter={
                    node.spouse.notes?.trim()
                      ? (e) => onNotesShow?.(node.spouse!.notes!.trim(), e.currentTarget.getBoundingClientRect())
                      : undefined
                  }
                  onMouseLeave={node.spouse.notes?.trim() ? onNotesHide : undefined}
                >
                  <button
                    type="button"
                    className={`tree-spouse-ref ${node.spouse.id === selectedId ? 'selected' : ''}`}
                    onClick={() => onSelect(node.spouse!)}
                    aria-label={t('treeView.spouse', { name: node.spouse.name })}
                  >
                    {t('treeView.spouse', { name: node.spouse.name })}
                  </button>
                </div>
              ) : (
                <div
                  className={`tree-node-card ${node.spouse.id === selectedId ? 'selected' : ''}`}
                  onClick={() => onSelect(node.spouse!)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={node.spouse.id === selectedId}
                  aria-label={`${node.spouse.name}${datesSpouseText ? `, ${datesSpouseText}` : ''}`}
                  onMouseEnter={
                    node.spouse.notes?.trim()
                      ? (e) => onNotesShow?.(node.spouse!.notes!.trim(), e.currentTarget.getBoundingClientRect())
                      : undefined
                  }
                  onMouseLeave={node.spouse.notes?.trim() ? onNotesHide : undefined}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(node.spouse!)
                    }
                  }}
                >
                  <Avatar name={node.spouse.name} avatar={node.spouse.avatar} gender={node.spouse.gender} className="tree-node-avatar" />
                  <p className="tree-node-title">{node.spouse.title?.trim() ? node.spouse.title.trim() : t(spouseTitleKey)}</p>
                  <p className="name">{node.spouse.name}</p>
                  {datesSpouseContent != null && <p className="dates">{datesSpouseContent}</p>}
                </div>
              )}
            </>
          )}
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
                mainPersonIds={mainPersonIds}
                selectedId={selectedId}
                onSelect={onSelect}
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
