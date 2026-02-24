import { useState, useEffect } from 'react'
import {
  addPerson,
  updatePerson,
  deletePerson,
  addParentChild,
  addSpouse,
  removeRelationship,
  getState,
  getParentIds,
  getChildrenIds,
  getSpouseId,
  getParentRelationships,
  getChildRelationships,
  getSpouseRelationship,
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
  const [birthDate, setBirthDate] = useState(person?.birthDate ?? '')
  const [deathDate, setDeathDate] = useState(person?.deathDate ?? '')
  const [birthDateInput, setBirthDateInput] = useState(person?.birthDate ? formatDateDisplay(person.birthDate) : '')
  const [deathDateInput, setDeathDateInput] = useState(person?.deathDate ? formatDateDisplay(person.deathDate) : '')
  const [gender, setGender] = useState<Person['gender']>(person?.gender ?? undefined)
  const [notes, setNotes] = useState(person?.notes ?? '')
  /** string = data URL, null = user removed, undefined = use person's current */
  const [avatar, setAvatar] = useState<string | null | undefined>(person?.avatar ?? undefined)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (person) {
      setName(person.name)
      setTitle(person.title ?? '')
      setAddress(person.address ?? '')
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
    const birthIso = parseDateInput(birthDateInput) || birthDate
    const deathIso = parseDateInput(deathDateInput) || deathDate
    try {
      if (isNew) {
        addPerson({
          name: name.trim(),
          title: title.trim() || undefined,
          address: address.trim() || undefined,
          birthDate: birthIso || undefined,
          deathDate: deathIso || undefined,
          gender,
          notes: notes.trim() || undefined,
          avatar: avatar || undefined,
        })
        onSaved()
      } else {
        updatePerson(person.id, {
          name: name.trim(),
          title: title.trim() || undefined,
          address: address.trim() || undefined,
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
  const spouseId = person ? getSpouseId(person.id) : undefined

  const [addParentId, setAddParentId] = useState('')
  const [addChildId, setAddChildId] = useState('')
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

  const addSpouseRel = () => {
    if (person && addSpouseId) {
      addSpouse(person.id, addSpouseId)
      setAddSpouseId('')
    }
  }

  return (
    <div className="person-form">
      <h2 id="person-form-title" className="form-title">{isNew ? t('form.addPerson') : t('form.editPerson')}</h2>
      <form onSubmit={handleSubmit}>
        <div className="person-form-grid">
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
          <div className="form-group">
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
          <div className="form-group">
            <label htmlFor="address">{t('form.address')}</label>
            <input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('form.address')}
            />
          </div>
          <div className="form-group">
            <label htmlFor="birth">{t('form.birthDate')}</label>
            <input
              id="birth"
              type="text"
              inputMode="numeric"
              placeholder="dd/MM/yyyy"
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
          <div className="form-group">
            <label htmlFor="death">{t('form.deathDate')}</label>
            <input
              id="death"
              type="text"
              inputMode="numeric"
              placeholder="dd/MM/yyyy"
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
          <div className="form-group form-group--avatar">
            <label>{t('form.avatar')}</label>
            <div className="avatar-upload">
              <div className="avatar-preview">
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
                    onClick={removeAvatar}
                  >
                    {t('form.removePhoto')}
                  </button>
                ) : null}
              </div>
              <label className="btn secondary avatar-label">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="avatar-input"
                />
                {(avatar !== undefined && avatar !== null) || (person?.avatar && avatar !== null) ? t('form.changePhoto') : t('form.uploadPhoto')}
              </label>
            </div>
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

      {!isNew && person && (
        <>
          <p className="section-title">{t('form.relationships')}</p>
          <div className="rel-current">
            {getParentRelationships(person.id).map(({ id, person: p }) => (
              <div key={id} className="rel-item">
                <span className="rel-label">{t('form.parent')}</span>
                <span className="rel-name">{p.name}</span>
                <button type="button" className="btn danger rel-remove" onClick={() => removeRelationship(id)} title={t('form.removeRelationship')}>
                  {t('form.remove')}
                </button>
              </div>
            ))}
            {getChildRelationships(person.id).map(({ id, person: p }) => (
              <div key={id} className="rel-item">
                <span className="rel-label">{t('form.child')}</span>
                <span className="rel-name">{p.name}</span>
                <button type="button" className="btn danger rel-remove" onClick={() => removeRelationship(id)} title={t('form.removeRelationship')}>
                  {t('form.remove')}
                </button>
              </div>
            ))}
            {getSpouseRelationship(person.id) && (() => {
              const rel = getSpouseRelationship(person.id)!
              return (
                <div key={rel.id} className="rel-item">
                  <span className="rel-label">{t('form.spouse')}</span>
                  <span className="rel-name">{rel.person.name}</span>
                  <button type="button" className="btn danger rel-remove" onClick={() => removeRelationship(rel.id)} title={t('form.removeRelationship')}>
                    {t('form.remove')}
                  </button>
                </div>
              )
            })()}
            {getParentRelationships(person.id).length === 0 &&
              getChildRelationships(person.id).length === 0 &&
              !getSpouseRelationship(person.id) && (
                <p className="rel-none">{t('form.noRelationships')}</p>
              )}
          </div>
          <div className="rel-actions">
            {others.length > 0 && (
              <>
                <div className="rel-actions-row">
                  <div className="rel-actions-col">
                    <label>{t('form.addParent')}</label>
                    <SearchablePersonSelect
                      id="add-parent-select"
                      options={others.filter((o) => !parentIds.includes(o.id))}
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
                      disabled={!addParentId}
                    >
                      {t('form.addAsParent')}
                    </button>
                  </div>
                  <div className="rel-actions-col">
                    <label>{t('form.addChild')}</label>
                    <SearchablePersonSelect
                      id="add-child-select"
                      options={others.filter((o) => !childIds.includes(o.id))}
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
                      disabled={!addChildId}
                    >
                      {t('form.addAsChild')}
                    </button>
                  </div>
                </div>
                <label>{t('form.addSpouse')}</label>
                <SearchablePersonSelect
                  id="add-spouse-select"
                  options={others.filter((o) => o.id !== spouseId)}
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
                  disabled={!addSpouseId}
                >
                  {t('form.addAsSpouse')}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
