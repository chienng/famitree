import type { Person, TreeNode } from './types'
import {
  getState,
  getChildrenIds,
  getSpouseIds,
  getPerson,
  getParentIds,
} from './store'

const PARENT_CHILD_REL_TYPES = ['parent-child', 'parent-child-in-law', 'parent-child-adopt'] as const

/** Build tree nodes starting from roots (people with no parents in the tree or no parent-child rels). */
export function buildTree(): TreeNode[] {
  const { people, relationships } = getState()
  const parentChildRels = relationships.filter((r) =>
    PARENT_CHILD_REL_TYPES.includes(r.type as (typeof PARENT_CHILD_REL_TYPES)[number])
  )
  const childIds = new Set(parentChildRels.map((r) => r.relatedId))
  const roots = people.filter((p) => !childIds.has(p.id))
  if (roots.length === 0 && people.length > 0) {
    return people.map((p) => nodeFromPerson(p))
  }
  const seen = new Set<string>()
  return roots.map((p) => buildNode(p.id, seen))
}

/**
 * Build tree with only male roots, each root built with an independent seen set
 * so every branch has full depth (no truncation). Use when showing "all branches".
 */
export function buildTreeMaleRootsOnly(): TreeNode[] {
  const nodes = buildTree()
  const maleRoots = nodes.filter((n) => n.person.gender === 'male')
  if (maleRoots.length === 0) return []
  return maleRoots.map((root) => buildNode(root.person.id, new Set<string>()))
}

function nodeFromPerson(person: Person): TreeNode {
  const spouseIds = getSpouseIds(person.id)
  const spouses = spouseIds.map((id) => getPerson(id)).filter((p): p is Person => !!p)
  return {
    person,
    children: [],
    spouse: spouses[0],
    spouses,
  }
}

function buildNode(personId: string, seen: Set<string>): TreeNode {
  const person = getPerson(personId)
  if (!person) return { person: { id: '', name: '?' }, children: [], spouses: [] }
  if (seen.has(personId)) return { person, children: [], spouses: [] }
  seen.add(personId)
  const childIds = getChildrenIds(personId)
  const children = childIds
    .map((id) => buildNode(id, seen))
    .filter((n) => n.person.id)
  const spouseIds = getSpouseIds(personId)
  const spouses = spouseIds.map((id) => getPerson(id)).filter((p): p is Person => !!p)
  return { person, children, spouse: spouses[0], spouses }
}

/** IDs of people who appear as the main person in some node (not only as spouse). */
export function getMainPersonIds(nodes: TreeNode[]): Set<string> {
  const ids = new Set<string>()
  function collect(nodes: TreeNode[]) {
    for (const node of nodes) {
      ids.add(node.person.id)
      collect(node.children)
    }
  }
  collect(nodes)
  return ids
}

/** Collect person id and all descendant ids (recursive). */
export function getPersonIdsInBranch(personId: string): Set<string> {
  const ids = new Set<string>()
  function collect(id: string) {
    if (ids.has(id)) return
    ids.add(id)
    getChildrenIds(id).forEach(collect)
  }
  collect(personId)
  return ids
}

/** Person IDs in branch: root + spouse(s) + all descendants and their spouses. */
export function getBranchPersonIds(rootPersonId: string): Set<string> {
  const ids = getPersonIdsInBranch(rootPersonId)
  const withSpouses = new Set(ids)
  ids.forEach((id) => {
    getSpouseIds(id).forEach((sid) => withSpouses.add(sid))
  })
  return withSpouses
}

/** Build a tree rooted at the given person (that person + spouse + descendants). Returns array of one node or empty if person not found. */
export function buildTreeRootedAt(personId: string): TreeNode[] {
  const person = getPerson(personId)
  if (!person) return []
  const seen = new Set<string>()
  return [buildNode(personId, seen)]
}

/** Ancestor generations for focus view: [0] = parents, [1] = grandparents, etc. Max levels default 2. */
export function getAncestorLevels(personId: string, maxLevels: number = 2): Person[][] {
  const levels: Person[][] = []
  let currentIds: string[] = [personId]
  for (let level = 0; level < maxLevels; level++) {
    const nextIds = new Set<string>()
    for (const id of currentIds) {
      getParentIds(id).forEach((pid) => nextIds.add(pid))
    }
    currentIds = [...nextIds]
    if (currentIds.length === 0) break
    const people = currentIds.map((id) => getPerson(id)).filter((p): p is Person => !!p)
    if (people.length > 0) levels.push(people)
  }
  return levels.reverse()
}

/** Generation level (đời): 1 = root, 2 = child of root, etc. Uses cache to avoid recomputation. */
export function getPersonLevel(personId: string, cache: Map<string, number> = new Map()): number {
  if (cache.has(personId)) return cache.get(personId)!
  const parentIds = getParentIds(personId)
  if (parentIds.length === 0) {
    cache.set(personId, 1)
    return 1
  }
  const level = 1 + Math.min(...parentIds.map((id) => getPersonLevel(id, cache)))
  cache.set(personId, level)
  return level
}

/**
 * Generation level relative to a branch root: 1 = branch root, 2 = their children, etc.
 * Only considers parents that are inside the branch. Use for list grouping when a branch is selected.
 */
export function getPersonLevelInBranch(
  personId: string,
  branchRootId: string,
  branchPersonIds: Set<string>,
  cache: Map<string, number> = new Map()
): number {
  if (cache.has(personId)) return cache.get(personId)!
  if (personId === branchRootId) {
    cache.set(personId, 1)
    return 1
  }
  const parentIds = getParentIds(personId).filter((id) => branchPersonIds.has(id))
  if (parentIds.length === 0) {
    cache.set(personId, 1)
    return 1
  }
  const level = 1 + Math.min(...parentIds.map((id) => getPersonLevelInBranch(id, branchRootId, branchPersonIds, cache)))
  cache.set(personId, level)
  return level
}

/**
 * Build a map of personId -> generation level from the actual tree structure (same as tree view).
 * 1 = root nodes, 2 = their children, etc. Use this for list grouping so list matches tree.
 */
export function getPersonLevelFromNodes(nodes: TreeNode[]): Map<string, number> {
  const map = new Map<string, number>()
  function walk(nodes: TreeNode[], level: number) {
    for (const node of nodes) {
      map.set(node.person.id, level)
      walk(node.children, level + 1)
    }
  }
  walk(nodes, 1)
  return map
}

/** Find a single root for display (first root, or first person). */
export function getDisplayRoot(): TreeNode | null {
  const nodes = buildTree()
  if (nodes.length === 0) return null
  return nodes[0]
}

function nameMatches(name: string, query: string): boolean {
  return name.trim().toLowerCase().includes(query.trim().toLowerCase())
}

/** Filter tree to nodes that match the search query or have a matching descendant. */
export function filterTreeByQuery(nodes: TreeNode[], query: string): TreeNode[] {
  const q = query.trim()
  if (!q) return nodes
  return nodes
    .map((node) => filterNodeByQuery(node, q))
    .filter((node) => node !== null) as TreeNode[]
}

function filterNodeByQuery(node: TreeNode, query: string): TreeNode | null {
  const selfMatches =
    nameMatches(node.person.name, query) ||
    node.spouses.some((sp) => nameMatches(sp.name, query))
  const filteredChildren = node.children
    .map((child) => filterNodeByQuery(child, query))
    .filter((n): n is TreeNode => n !== null)
  if (selfMatches || filteredChildren.length > 0) {
    return {
      ...node,
      children: filteredChildren,
    }
  }
  return null
}
