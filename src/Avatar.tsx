type Gender = 'male' | 'female' | 'other'

interface AvatarProps {
  name: string
  avatar?: string
  gender?: Gender
  className?: string
}

/** Placeholder image URLs when user has not uploaded an avatar. */
const DEFAULT_AVATAR_URLS = {
  male:
    'https://previews.123rf.com/images/archivector/archivector1902/archivector190200317/117964202-abstract-sign-avatar-men-icon-male-profile-white-symbol-on-gray-circle-background-vector.jpg',
  female:
    'https://previews.123rf.com/images/archivector/archivector1902/archivector190200316/117964201-abstract-sign-avatar-woman-icon-female-profile-white-symbol-on-gray-circle-background-vector.jpg',
} as const

/** Neutral/other uses male placeholder; replace with a custom URL if desired. */
const DEFAULT_AVATAR_NEUTRAL = DEFAULT_AVATAR_URLS.male

function getDefaultAvatarUrl(gender?: Gender): string {
  if (gender === 'female') return DEFAULT_AVATAR_URLS.female
  if (gender === 'male') return DEFAULT_AVATAR_URLS.male
  return DEFAULT_AVATAR_NEUTRAL
}

export function Avatar({ name, avatar, gender, className = '' }: AvatarProps) {
  const imageUrl = avatar ?? getDefaultAvatarUrl(gender)

  return (
    <div className={className}>
      <img src={imageUrl} alt="" title={name} />
    </div>
  )
}
