/** Member role in the family. Con dâu/con rể can only be added when declaring a main member's spouse. */
export type MemberRole = 'main' | 'daughter-in-law' | 'son-in-law'

export interface Person {
  id: string
  name: string
  title?: string
  address?: string
  /** Place of birth */
  birthPlace?: string
  birthDate?: string
  deathDate?: string
  /** Place of burial (e.g. cemetery name, location) */
  buriedAt?: string
  gender?: 'male' | 'female' | 'other'
  notes?: string
  /** Data URL (e.g. base64 image) for profile photo */
  avatar?: string
  /** Role in family. Default 'main'. Daughter-/son-in-law only when added as spouse of a main member. */
  memberRole?: MemberRole
}

export type ParentChildRelationshipType = 'parent-child' | 'parent-child-in-law' | 'parent-child-adopt'

export interface Relationship {
  id: string
  type: 'parent-child' | 'parent-child-in-law' | 'parent-child-adopt' | 'spouse'
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
  /** First spouse (backward compat). Prefer using spouses for multiple. */
  spouse?: Person
  /** All spouses in order (vợ/chồng 1, 2, ...). */
  spouses: Person[]
}
