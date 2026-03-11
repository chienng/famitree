import { useState, useEffect, useRef } from 'react'
import {
  addPerson,
  updatePerson,
  deletePerson,
  addParentChild,
  addParentChildInLaw,
  addParentChildAdopt,
  addSpouse,
  removeRelationship,
  getState,
  getParentIds,
  getChildrenIds,
  getSpouseIds,
  getSpouseRelationships,
  getParentRelationships,
  getChildRelationships,
} from './store'
import type { Person } from './types'
import { Avatar } from './Avatar'
import { useLocale } from './LocaleContext'
import { formatDateDisplay, parseDateInput } from './dateUtils'
import { SearchablePersonSelect } from './SearchablePersonSelect'
import './App.css'

interface PersonFormProps {
  person?: Person | null
  onClose: () => void
  onSaved: () => void
}

export function PersonForm({ person, onClose, onSaved }: PersonFormProps) {
  const { t } = useLocale()
  const isNew = !person
  const [name, setName] = useState(person?.name ?? '')
  const [title, setTitle] = useState(person?.title ?? '')
  const [address, setAddress] = useState(person?.address ?? '')
  const [birthPlace, setBirthPlace] = useState(person?.birthPlace ?? '')
  const [buriedAt, setBuriedAt] = useState(person?.buriedAt ?? '')
  const [birthDate, setBirthDate] = useState(person?.birthDate ?? '')
  const [deathDate, setDeathDate] = useState(person?.deathDate ?? '')
  const [birthDateInput, setBirthDateInput] = useState(person?.birthDate ? formatDateDisplay(person.birthDate) : '')
  const [deathDateInput, setDeathDateInput] = useState(person?.deathDate ? formatDateDisplay(person.deathDate) : '')
  const [gender, setGender] = useState<Person['gender']>(person?.gender ?? undefined)
  const [notes, setNotes] = useState(person?.notes ?? '')
  /** string = data URL, null = user removed, undefined = use person's current */
  const [avatar, setAvatar] = useState<string | null | undefined>(person?.avatar ?? undefined)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (person) {
      setName(person.name)
      setTitle(person.title ?? '')
      setAddress(person.address ?? '')
      setBirthPlace(person.birthPlace ?? '')
      setBuriedAt(person.buriedAt ?? '')
      setBirthDate(person.birthDate ?? '')
      setDeathDate(person.deathDate ?? '')
      setBirthDateInput(person.birthDate ? formatDateDisplay(person.birthDate) : '')
      setDeathDateInput(person.deathDate ? formatDateDisplay(person.deathDate) : '')
      setGender(person.gender)
      setNotes(person.notes ?? '')
      setAvatar(person.avatar)
    }
  }, [person?.id])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    if (name.trim() == "") return setSubmitError("Name is required")
    const birthIso = !birthDateInput.trim() ? undefined : (parseDateInput(birthDateInput) || birthDateInput.trim() || birthDate)
    const deathIso = !deathDateInput.trim() ? undefined : (parseDateInput(deathDateInput) || deathDateInput.trim() || deathDate)
    try {
      if (isNew) {
        addPerson({
          name: name.trim(),
          title: title.trim() || undefined,
          address: address.trim() || undefined,
          birthPlace: birthPlace.trim() || undefined,
          buriedAt: buriedAt.trim() || undefined,
          birthDate: birthIso || undefined,
          deathDate: deathIso || undefined,
          gender,
          notes: notes.trim() || undefined,
          avatar: avatar || undefined,
          memberRole: 'main',
        })
        onSaved()
      } else {
        updatePerson(person.id, {
          name: name.trim(),
          title: title.trim() || undefined,
          address: address.trim() || undefined,
          birthPlace: birthPlace.trim() || undefined,
          buriedAt: buriedAt.trim() || undefined,
          birthDate: birthIso || undefined,
          deathDate: deathIso || undefined,
          gender,
          notes: notes.trim() || undefined,
          avatar: avatar === null ? undefined : (avatar !== undefined ? avatar : person.avatar),
        })
        onSaved()
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => setAvatar(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const removeAvatar = () => setAvatar(null)

  const handleDelete = () => {
    if (person && confirm(t('form.deleteConfirm', { name: person.name }))) {
      deletePerson(person.id)
      onSaved()
    }
  }

  const state = getState()
  const others = state.people.filter((p) => p.id !== person?.id)
  const parentIds = person ? getParentIds(person.id) : []
  const childIds = person ? getChildrenIds(person.id) : []
  const spouseIds = person ? getSpouseIds(person.id) : []

  const [addParentId, setAddParentId] = useState('')
  const [addChildId, setAddChildId] = useState('')
  const [addParentInLawId, setAddParentInLawId] = useState('')
  const [addParentAdoptId, setAddParentAdoptId] = useState('')
  const [addChildInLawId, setAddChildInLawId] = useState('')
  const [addChildAdoptId, setAddChildAdoptId] = useState('')
  const [addSpouseId, setAddSpouseId] = useState('')

  const addParent = () => {
    if (person && addParentId) {
      addParentChild(addParentId, person.id)
      setAddParentId('')
    }
  }

  const addChild = () => {
    if (person && addChildId) {
      addParentChild(person.id, addChildId)
      setAddChildId('')
    }
  }

  const addParentInLaw = () => {
    if (person && addParentInLawId) {
      addParentChildInLaw(addParentInLawId, person.id)
      setAddParentInLawId('')
    }
  }

  const addParentAdopt = () => {
    if (person && addParentAdoptId) {
      addParentChildAdopt(addParentAdoptId, person.id)
      setAddParentAdoptId('')
    }
  }

  const addChildInLaw = () => {
    if (person && addChildInLawId) {
      addParentChildInLaw(person.id, addChildInLawId)
      setAddChildInLawId('')
    }
  }

  const addChildAdopt = () => {
    if (person && addChildAdoptId) {
      addParentChildAdopt(person.id, addChildAdoptId)
      setAddChildAdoptId('')
    }
  }

  const addSpouseRel = () => {
    if (person && addSpouseId) {
      addSpouse(person.id, addSpouseId)
      setAddSpouseId('')
    }
  }

  const parentRelLabel = (type: 'parent-child' | 'parent-child-in-law' | 'parent-child-adopt') =>
    type === 'parent-child' ? t('form.parent') : type === 'parent-child-in-law' ? t('form.parentInLaw') : t('form.parentAdopt')
  const childRelLabel = (type: 'parent-child' | 'parent-child-in-law' | 'parent-child-adopt') =>
    type === 'parent-child' ? t('form.child') : type === 'parent-child-in-law' ? t('form.childInLaw') : t('form.childAdopt')

  const formTitle = isNew ? t('form.addPerson') : t('form.editPerson')

  return (
    <div className="person-form">
      <h2 id="person-form-title" className="form-title">{formTitle}</h2>
      <form onSubmit={handleSubmit}>
        <div className="person-form-grid">
          <div className="form-group form-group--avatar">
            <div className="avatar-upload">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="avatar-input"
                aria-hidden
              />
              <div
                className="avatar-preview avatar-preview--clickable"
                onClick={() => avatarInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); avatarInputRef.current?.click() } }}
                aria-label={(avatar !== undefined && avatar !== null) || (person?.avatar && avatar !== null) ? t('form.changePhoto') : t('form.uploadPhoto')}
              >
                <Avatar
                  name={name}
                  avatar={(avatar !== undefined && avatar !== null ? avatar : person?.avatar) ?? undefined}
                  gender={gender}
                  className="avatar-preview-img"
                />
                {(avatar !== undefined && avatar !== null) || (person?.avatar && avatar !== null) ? (
                  <button
                    type="button"
                    className="btn secondary avatar-remove"
                    onClick={(e) => { e.stopPropagation(); removeAvatar() }}
                  >
                    {t('form.removePhoto')}
                  </button>
                ) : null}
              </div>
              <span className="avatar-hint">
                {(avatar !== undefined && avatar !== null) || (person?.avatar && avatar !== null) ? t('form.clickToChangePhoto') : t('form.clickToUploadPhoto')}
              </span>
            </div>
          </div>
          {/* Left column: Name, Gender, Birth date, Birth place */}
          <div className="form-group">
            <label htmlFor="name">{t('form.name')}</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('form.fullName')}
              required
            />
          </div>
          <div className="form-group form-group--right">
            <label htmlFor="title">{t('form.title')}</label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('form.title')}
            />
          </div>
          <div className="form-group">
            <label htmlFor="gender">{t('form.gender')}</label>
            <select
              id="gender"
              value={gender ?? ''}
              onChange={(e) =>
                setGender((e.target.value || undefined) as Person['gender'])
              }
            >
              <option value="">—</option>
              <option value="male">{t('gender.male')}</option>
              <option value="female">{t('gender.female')}</option>
            </select>
          </div>
          <div className="form-group form-group--right">
            <label htmlFor="death">{t('form.deathDate')}</label>
            <input
              id="death"
              type="text"
              placeholder={t('form.deathDatePlaceholder')}
              value={deathDateInput}
              onChange={(e) => {
                const v = e.target.value
                setDeathDateInput(v)
                if (!v.trim()) setDeathDate('')
                else {
                  const parsed = parseDateInput(v)
                  if (parsed) setDeathDate(parsed)
                }
              }}
              onBlur={() => {
                const parsed = parseDateInput(deathDateInput)
                if (parsed) setDeathDateInput(formatDateDisplay(parsed))
              }}
            />
          </div>
          <div className="form-group">
            <label htmlFor="birth">{t('form.birthDate')}</label>
            <input
              id="birth"
              type="text"
              placeholder={t('form.datePlaceholder')}
              value={birthDateInput}
              onChange={(e) => {
                const v = e.target.value
                setBirthDateInput(v)
                if (!v.trim()) setBirthDate('')
                else {
                  const parsed = parseDateInput(v)
                  if (parsed) setBirthDate(parsed)
                }
              }}
              onBlur={() => {
                const parsed = parseDateInput(birthDateInput)
                if (parsed) setBirthDateInput(formatDateDisplay(parsed))
              }}
            />
          </div>
          <div className="form-group form-group--right">
            <label htmlFor="buriedAt">{t('form.buriedAt')}</label>
            <input
              id="buriedAt"
              value={buriedAt}
              onChange={(e) => setBuriedAt(e.target.value)}
              placeholder={t('form.buriedAtPlaceholder')}
            />
          </div>
          <div className="form-group">
            <label htmlFor="birthPlace">{t('form.birthPlace')}</label>
            <input
              id="birthPlace"
              type="text"
              value={birthPlace}
              onChange={(e) => setBirthPlace(e.target.value)}
              placeholder={t('form.birthPlacePlaceholder')}
            />
          </div>
          <div className="form-group form-group--right">
            <label htmlFor="address">{t('form.address')}</label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('form.address')}
            />
          </div>
          <div className="form-group form-group--notes">
            <label htmlFor="notes">{t('form.notes')}</label>
            <textarea
              id="notes"
              className="form-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('form.optionalNotes')}
              rows={3}
            />
          </div>
        </div>
        {submitError && (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        )}
        <div className="form-actions">
          {!isNew && (
            <button
              type="button"
              className="btn danger"
              onClick={handleDelete}
            >
              {t('form.delete')}
            </button>
          )}
          <button type="button" className="btn secondary" onClick={onClose}>
            {isNew ? t('form.cancel') : t('form.close')}
          </button>
          <button type="submit" className="btn primary">
            {isNew ? t('form.add') : t('form.save')}
          </button>
        </div>
      </form>

      <p className="section-title">{t('form.relationships')}</p>
      <div className="rel-current">
        {isNew ? (
          <p className="rel-none">{t('form.saveFirstToAddRelationships')}</p>
        ) : person ? (
          <>
            {getParentRelationships(person.id).map(({ id, person: p, type }) => (
              <div key={id} className="rel-item">
                <span className="rel-label">{parentRelLabel(type)}</span>
                <span className="rel-name">{p.name}</span>
                <button type="button" className="btn danger rel-remove" onClick={() => removeRelationship(id)} title={t('form.removeRelationship')}>
                  {t('form.remove')}
                </button>
              </div>
            ))}
            {getChildRelationships(person.id).map(({ id, person: p, type }) => (
              <div key={id} className="rel-item">
                <span className="rel-label">{childRelLabel(type)}</span>
                <span className="rel-name">{p.name}</span>
                <button type="button" className="btn danger rel-remove" onClick={() => removeRelationship(id)} title={t('form.removeRelationship')}>
                  {t('form.remove')}
                </button>
              </div>
            ))}
            {getSpouseRelationships(person.id).map((rel) => {
              const spouseLabel =
                rel.person.memberRole === 'daughter-in-law'
                  ? t('form.daughterInLaw')
                  : rel.person.memberRole === 'son-in-law'
                    ? t('form.sonInLaw')
                    : rel.index > 1
                      ? t('form.spouseN', { n: rel.index })
                      : t('form.spouse')
              return (
                <div key={rel.id} className="rel-item">
                  <span className="rel-label">{spouseLabel}</span>
                  <span className="rel-name">{rel.person.name}</span>
                  <button type="button" className="btn danger rel-remove" onClick={() => removeRelationship(rel.id)} title={t('form.removeRelationship')}>
                    {t('form.remove')}
                  </button>
                </div>
              )
            })}
            {getParentRelationships(person.id).length === 0 &&
              getChildRelationships(person.id).length === 0 &&
              getSpouseRelationships(person.id).length === 0 && (
                <p className="rel-none">{t('form.noRelationships')}</p>
              )}
          </>
        ) : null}
      </div>
      <div className={`rel-actions ${isNew ? 'rel-actions--disabled' : ''}`}>
        {(isNew || (person && others.length > 0)) && (
              <>
                <div className="rel-actions-row">
                  <div className="rel-actions-col">
                    <label>{t('form.addParent')}</label>
                    <SearchablePersonSelect
                      id={isNew ? 'add-parent-select-new' : 'add-parent-select'}
                      options={isNew ? [] : others.filter((o) => !parentIds.includes(o.id))}
                      value={addParentId}
                      onChange={setAddParentId}
                      placeholder={t('form.selectPerson')}
                      searchPlaceholder={t('form.searchPerson')}
                      emptyLabel={t('form.noOptions')}
                      noMatchesLabel={t('form.noMatches')}
                    />
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={addParent}
                      disabled={isNew || !addParentId}
                    >
                      {t('form.addAsParent')}
                    </button>
                  </div>
                  <div className="rel-actions-col">
                    <label>{t('form.addSpouse')}</label>
                    <SearchablePersonSelect
                      id={isNew ? 'add-spouse-select-new' : 'add-spouse-select'}
                      options={isNew ? [] : others.filter((o) => !spouseIds.includes(o.id))}
                      value={addSpouseId}
                      onChange={setAddSpouseId}
                      placeholder={t('form.selectPerson')}
                      searchPlaceholder={t('form.searchPerson')}
                      emptyLabel={t('form.noOptions')}
                      noMatchesLabel={t('form.noMatches')}
                    />
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={addSpouseRel}
                      disabled={isNew || !addSpouseId}
                    >
                      {t('form.addAsSpouse')}
                    </button>
                  </div>
                  <div className="rel-actions-col">
                    <label>{t('form.addChild')}</label>
                    <SearchablePersonSelect
                      id={isNew ? 'add-child-select-new' : 'add-child-select'}
                      options={isNew ? [] : others.filter((o) => !childIds.includes(o.id))}
                      value={addChildId}
                      onChange={setAddChildId}
                      placeholder={t('form.selectPerson')}
                      searchPlaceholder={t('form.searchPerson')}
                      emptyLabel={t('form.noOptions')}
                      noMatchesLabel={t('form.noMatches')}
                    />
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={addChild}
                      disabled={isNew || !addChildId}
                    >
                      {t('form.addAsChild')}
                    </button>
                  </div>
                  <div className="rel-actions-col">
                    <label>{t('form.addParentInLaw')}</label>
                    <SearchablePersonSelect
                      id={isNew ? 'add-parent-inlaw-select-new' : 'add-parent-inlaw-select'}
                      options={isNew ? [] : others.filter((o) => !parentIds.includes(o.id))}
                      value={addParentInLawId}
                      onChange={setAddParentInLawId}
                      placeholder={t('form.selectPerson')}
                      searchPlaceholder={t('form.searchPerson')}
                      emptyLabel={t('form.noOptions')}
                      noMatchesLabel={t('form.noMatches')}
                    />
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={addParentInLaw}
                      disabled={isNew || !addParentInLawId}
                    >
                      {t('form.addAsParentInLaw')}
                    </button>
                  </div>
                  <div className="rel-actions-col">
                    <label>{t('form.addChildInLaw')}</label>
                    <SearchablePersonSelect
                      id={isNew ? 'add-child-inlaw-select-new' : 'add-child-inlaw-select'}
                      options={isNew ? [] : others.filter((o) => !childIds.includes(o.id))}
                      value={addChildInLawId}
                      onChange={setAddChildInLawId}
                      placeholder={t('form.selectPerson')}
                      searchPlaceholder={t('form.searchPerson')}
                      emptyLabel={t('form.noOptions')}
                      noMatchesLabel={t('form.noMatches')}
                    />
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={addChildInLaw}
                      disabled={isNew || !addChildInLawId}
                    >
                      {t('form.addAsChildInLaw')}
                    </button>
                  </div>                  
                  <div className="rel-actions-col">
                    <label>{t('form.addParentAdopt')}</label>
                    <SearchablePersonSelect
                      id={isNew ? 'add-parent-adopt-select-new' : 'add-parent-adopt-select'}
                      options={isNew ? [] : others.filter((o) => !parentIds.includes(o.id))}
                      value={addParentAdoptId}
                      onChange={setAddParentAdoptId}
                      placeholder={t('form.selectPerson')}
                      searchPlaceholder={t('form.searchPerson')}
                      emptyLabel={t('form.noOptions')}
                      noMatchesLabel={t('form.noMatches')}
                    />
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={addParentAdopt}
                      disabled={isNew || !addParentAdoptId}
                    >
                      {t('form.addAsParentAdopt')}
                    </button>
                  </div>
                  <div className="rel-actions-col">
                    <label>{t('form.addChildAdopt')}</label>
                    <SearchablePersonSelect
                      id={isNew ? 'add-child-adopt-select-new' : 'add-child-adopt-select'}
                      options={isNew ? [] : others.filter((o) => !childIds.includes(o.id))}
                      value={addChildAdoptId}
                      onChange={setAddChildAdoptId}
                      placeholder={t('form.selectPerson')}
                      searchPlaceholder={t('form.searchPerson')}
                      emptyLabel={t('form.noOptions')}
                      noMatchesLabel={t('form.noMatches')}
                    />
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={addChildAdopt}
                      disabled={isNew || !addChildAdoptId}
                    >
                      {t('form.addAsChildAdopt')}
                    </button>
                  </div>
                </div>
              </>
        )}
      </div>
    </div>
  )
}
