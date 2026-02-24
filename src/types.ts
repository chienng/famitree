export interface Person {
  id: string
  name: string
  title?: string
  address?: string
  birthDate?: string
  deathDate?: string
  gender?: 'male' | 'female' | 'other'
  notes?: string
  /** Data URL (e.g. base64 image) for profile photo */
  avatar?: string
}

export interface Relationship {
  id: string
  type: 'parent-child' | 'spouse'
  personId: string
  relatedId: string
}

export interface FamilyTreeState {
  people: Person[]
  relationships: Relationship[]
}

export type TreeNode = {
  person: Person
  children: TreeNode[]
  spouse?: Person
}
