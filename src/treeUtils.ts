import type { Person, TreeNode } from './types'
import {
  getState,
  getChildrenIds,
  getSpouseId,
  getPerson,
} from './store'

/** Build tree nodes starting from roots (people with no parents in the tree or no parent-child rels). */
export function buildTree(): TreeNode[] {
  const { people, relationships } = getState()
  const parentChild = relationships.filter((r) => r.type === 'parent-child')
  const childIds = new Set(parentChild.map((r) => r.relatedId))
  const roots = people.filter((p) => !childIds.has(p.id))
  if (roots.length === 0 && people.length > 0) {
    return people.map((p) => nodeFromPerson(p))
  }
  const seen = new Set<string>()
  return roots.map((p) => buildNode(p.id, seen))
}

function nodeFromPerson(person: Person): TreeNode {
  const spouseId = getSpouseId(person.id)
  const spouse = spouseId ? getPerson(spouseId) : undefined
  return {
    person,
    children: [],
    spouse,
  }
}

function buildNode(personId: string, seen: Set<string>): TreeNode {
  const person = getPerson(personId)
  if (!person) return { person: { id: '', name: '?' }, children: [] }
  if (seen.has(personId)) return { person, children: [] }
  seen.add(personId)
  const childIds = getChildrenIds(personId)
  const children = childIds
    .map((id) => buildNode(id, seen))
    .filter((n) => n.person.id)
  const spouseId = getSpouseId(personId)
  const spouse = spouseId ? getPerson(spouseId) : undefined
  return { person, children, spouse }
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
    const spouseId = getSpouseId(id)
    if (spouseId) withSpouses.add(spouseId)
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
    (node.spouse ? nameMatches(node.spouse.name, query) : false)
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
