import { getState, getPerson } from './store'
import { buildTree, buildTreeRootedAt, getBranchPersonIds } from './treeUtils'
import { getCurrentAge } from './dateUtils'
import { useLocale } from './LocaleContext'
import { BranchCombobox, type BranchOption } from './BranchCombobox'
import type { Person } from './types'

function countByAgeBand(people: Person[], min: number, max: number | null): number {
  return people.filter((p) => {
    const age = getCurrentAge(p.birthDate, p.deathDate)
    if (age === null) return false
    if (max === null) return age >= min
    return age >= min && age <= max
  }).length
}

/** Male, deceased, age at death >= 60. */
function countMaleDeceased60Plus(people: Person[]): number {
  return people.filter((p) => {
    if (p.gender !== 'male' || !p.deathDate?.trim()) return false
    const age = getCurrentAge(p.birthDate, p.deathDate)
    return age !== null && age >= 60
  }).length
}

function getBranchStats(people: Person[]) {
  const total = people.length
  const deceased = people.filter((p) => !!p.deathDate?.trim()).length
  const living = total - deceased
  const male = people.filter((p) => p.gender === 'male').length
  const female = people.filter((p) => p.gender === 'female').length
  return {
    total,
    deceased,
    living,
    male,
    female,
    maleDeceased60Plus: countMaleDeceased60Plus(people),
    age0to5: countByAgeBand(people, 0, 5),
    age6to17: countByAgeBand(people, 6, 17),
    age18to35: countByAgeBand(people, 18, 35),
    age36to50: countByAgeBand(people, 36, 50),
    age51to70: countByAgeBand(people, 51, 70),
    age70plus: countByAgeBand(people, 71, null),
  }
}

export interface TreeSummaryProps {
  /** When set, "by branch" section shows only this branch. Null = show all branches. */
  selectedBranchId?: string | null
  /** When provided, show branch filter below the "by branch" header. Used on Summary page. */
  onBranchChange?: (id: string | null) => void
  /** Branch options for the filter. Required when onBranchChange is provided. */
  branchOptions?: BranchOption[]
  /** Whether to show the branch filter. */
  showBranchFilter?: boolean
}

export function TreeSummary({
  selectedBranchId = null,
  onBranchChange,
  branchOptions = [],
  showBranchFilter = false,
}: TreeSummaryProps) {
  const { t } = useLocale()
  const state = getState()
  const treeNodes = buildTree()
  const branchFilterActive = selectedBranchId != null && getPerson(selectedBranchId) != null
  const byBranchNodes = branchFilterActive
    ? buildTreeRootedAt(selectedBranchId!)
    : treeNodes

  const totalMembers = state.people.length
  const parentChildRels = state.relationships.filter(
    (r) => r.type === 'parent-child' || r.type === 'parent-child-in-law' || r.type === 'parent-child-adopt'
  ).length
  const spouseRels = state.relationships.filter((r) => r.type === 'spouse').length
  const rootCount = treeNodes.length

  const deceased = state.people.filter((p) => !!p.deathDate?.trim()).length
  const living = totalMembers - deceased
  const maleMembers = state.people.filter((p) => p.gender === 'male').length
  const femaleMembers = state.people.filter((p) => p.gender === 'female').length
  const livingMaleMembers = state.people.filter((p) => p.gender === 'male' && !p.deathDate?.trim()).length
  const livingFemaleMembers = state.people.filter((p) => p.gender === 'female' && !p.deathDate?.trim()).length
  const age0to5 = countByAgeBand(state.people, 0, 5)
  const age6to17 = countByAgeBand(state.people, 6, 17)
  const age18to35 = countByAgeBand(state.people, 18, 35)
  const age36to50 = countByAgeBand(state.people, 36, 50)
  const age51to70 = countByAgeBand(state.people, 51, 70)
  const age70plus = countByAgeBand(state.people, 71, null)
  const maleDeceased60Plus = countMaleDeceased60Plus(state.people)

  if (totalMembers === 0) {
    return (
      <div className="tree-summary">
        <h3 className="tree-summary-title">{t('summary.title')}</h3>
        <p className="tree-summary-empty">{t('summary.empty')}</p>
      </div>
    )
  }

  return (
    <div className="tree-summary">
      {rootCount > 0 && showBranchFilter && (
        <div className="tree-summary-by-branch-section">
          <h4 className="tree-summary-subtitle">{t('summary.byBranch')}</h4>
          <div className="tree-summary-branch-filter">
            {onBranchChange && (
              <BranchCombobox
                id="summary-branch"
                value={selectedBranchId}
                onChange={onBranchChange}
                options={branchOptions}
                label={t('tree.branchLabel')}
                searchPlaceholder={t('tree.branchSearchPlaceholder')}
                allBranchesLabel={t('tree.branchAll')}
                inline
              />
            )}
          </div>
          {branchFilterActive && (
          <div className="tree-summary-branches">
            {byBranchNodes.map((root) => {
              const branchIds = getBranchPersonIds(root.person.id)
              const branchPeople = state.people.filter((p) => branchIds.has(p.id))
              const branchLabel = root.person.name?.trim() || t('summary.branchUnnamed')
              const stats = getBranchStats(branchPeople)
              return (
                <div key={root.person.id} className="tree-summary-branch">
                  <div className="tree-summary-branch-title">{branchLabel}</div>
                  <ul className="tree-summary-list tree-summary-branch-list">
                    <li className="tree-summary-item">
                      <span className="tree-summary-label">{t('summary.totalMembers')}</span>
                      <span className="tree-summary-value">{stats.total}</span>
                    </li>
                    <li className="tree-summary-item">
                      <span className="tree-summary-label">{t('summary.living')}</span>
                      <span className="tree-summary-value">{stats.living}</span>
                    </li>
                    <li className="tree-summary-item">
                      <span className="tree-summary-label">{t('summary.deceased')}</span>
                      <span className="tree-summary-value">{stats.deceased}</span>
                    </li>
                    <li className="tree-summary-item">
                      <span className="tree-summary-label">{t('summary.maleMembers')}</span>
                      <span className="tree-summary-value">{stats.male}</span>
                    </li>
                    <li className="tree-summary-item">
                      <span className="tree-summary-label">{t('summary.femaleMembers')}</span>
                      <span className="tree-summary-value">{stats.female}</span>
                    </li>
                    <li className="tree-summary-item">
                      <span className="tree-summary-label">{t('summary.maleDeceased60Plus')}</span>
                      <span className="tree-summary-value">{stats.maleDeceased60Plus}</span>
                    </li>
                  </ul>
                </div>
              )
            })}
          </div>
          )}
        </div>
      )}
      <h3 className="tree-summary-title">{t('summary.familyTreeSummary')}</h3>
      <ul className="tree-summary-list">
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.totalMembers')}</span>
          <span className="tree-summary-value">{totalMembers}</span>
        </li>
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.deceased')}</span>
          <span className="tree-summary-value">{deceased}</span>
        </li>
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.living')}</span>
          <span className="tree-summary-value">{living}</span>
        </li>
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.maleMembers')}</span>
          <span className="tree-summary-value">{maleMembers}</span>
        </li>
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.femaleMembers')}</span>
          <span className="tree-summary-value">{femaleMembers}</span>
        </li>
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.livingMaleMembers')}</span>
          <span className="tree-summary-value">{livingMaleMembers}</span>
        </li>
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.livingFemaleMembers')}</span>
          <span className="tree-summary-value">{livingFemaleMembers}</span>
        </li>
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.age0to5')}</span>
          <span className="tree-summary-value">{age0to5}</span>
        </li>
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.age6to17')}</span>
          <span className="tree-summary-value">{age6to17}</span>
        </li>
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.age18to35')}</span>
          <span className="tree-summary-value">{age18to35}</span>
        </li>
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.age36to50')}</span>
          <span className="tree-summary-value">{age36to50}</span>
        </li>
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.age51to70')}</span>
          <span className="tree-summary-value">{age51to70}</span>
        </li>
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.age70plus')}</span>
          <span className="tree-summary-value">{age70plus}</span>
        </li>
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.couples')}</span>
          <span className="tree-summary-value">{spouseRels}</span>
        </li>
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.parentChildLinks')}</span>
          <span className="tree-summary-value">{parentChildRels}</span>
        </li>
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.rootFamilies')}</span>
          <span className="tree-summary-value">{rootCount}</span>
        </li>
        <li className="tree-summary-item">
          <span className="tree-summary-label">{t('summary.maleDeceased60Plus')}</span>
          <span className="tree-summary-value">{maleDeceased60Plus}</span>
        </li>
      </ul>
    </div>
  )
}
