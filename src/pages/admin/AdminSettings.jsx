import { useEffect, useState } from 'react'
import { CONTACT, SITE } from '@/lib/constants'
import { INTRO_MODE, INTRO_MODE_STORAGE_KEY } from '@/lib/intro'

const STORAGE_KEY = 'markipie.admin.settings.draft'

const FIELDS = [
  { key: 'brand_name', label: 'Brand Name', placeholder: 'Markipie', help: 'Shown across the website.' },
  { key: 'instagram_url', label: 'Instagram URL', placeholder: 'https://www.instagram.com/…', help: 'The official studio Instagram profile.' },
  { key: 'whatsapp_number', label: 'WhatsApp Number', placeholder: '8586000345', help: 'Digits only, with country code for wa.me links (918586000345).' },
  { key: 'phone_number', label: 'Phone Number', placeholder: '8586000345', help: 'Number shown for call buttons.' },
]

const INTRO_OPTIONS = [
  { value: INTRO_MODE.EVERY_VISIT, label: 'Play on every visit (default)' },
  { value: INTRO_MODE.FIRST_VISIT, label: 'Play once per browser session' },
  { value: INTRO_MODE.SKIP, label: 'Skip the animation entirely' },
]

const PERMISSION_DEFAULTS = [
  { label: 'Watermark', value: 'On' },
  { label: 'Download', value: 'On' },
  { label: 'Like / Dislike', value: 'On' },
  { label: 'Face Scan', value: 'Off' },
  { label: 'Instagram Gate', value: 'On' },
]

/**
 * Settings: brand and contact channels, the opening animation behavior and
 * the default gallery permissions for new events. Contact drafts persist
 * locally so work is not lost while the studio decides values; applying
 * them to the live site is a deliberate later step. The intro setting
 * applies to the public site immediately, on every device where it is set.
 * No secrets are stored or readable here.
 */
export default function AdminSettings() {
  const [form, setForm] = useState(() => ({
    brand_name: SITE.name,
    instagram_url: CONTACT.instagramUrl,
    whatsapp_number: CONTACT.phone,
    phone_number: CONTACT.phone,
    email: CONTACT.email,
  }))
  const [savedAt, setSavedAt] = useState(null)
  const [introMode, setIntroMode] = useState(INTRO_MODE.EVERY_VISIT)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        setForm((previous) => ({ ...previous, ...JSON.parse(raw) }))
      }
    } catch {
      // Local drafts are a convenience; ignore malformed data.
    }
    try {
      const stored = window.localStorage.getItem(INTRO_MODE_STORAGE_KEY)
      if (Object.values(INTRO_MODE).includes(stored)) {
        setIntroMode(stored)
      }
    } catch {
      // Storage unavailable; the default mode stays.
    }
  }, [])

  const saveDraft = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
      setSavedAt(new Date())
    } catch {
      setSavedAt(null)
    }
  }

  const applyIntroMode = (mode) => {
    setIntroMode(mode)
    try {
      window.localStorage.setItem(INTRO_MODE_STORAGE_KEY, mode)
    } catch {
      // Storage unavailable; the choice lasts for this session only.
    }
  }

  return (
    <div className="mp-adm-page">
      <header className="mp-adm-page__head">
        <div>
          <h1 className="mp-adm-page__title">Settings</h1>
          <p className="mp-adm-page__sub">Brand details, contact channels and site behavior.</p>
        </div>
      </header>

      <div className="mp-adm-settings">
        <form
          className="mp-adm-form"
          onSubmit={(event) => {
            event.preventDefault()
            saveDraft()
          }}
        >
          {FIELDS.map((field) => (
            <label className="mp-field" key={field.key}>
              <span className="mp-field__label">{field.label}</span>
              <input
                className="mp-field__input"
                type={field.key === 'instagram_url' ? 'url' : 'text'}
                value={form[field.key] ?? ''}
                onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                placeholder={field.placeholder}
              />
              <span className="mp-adm-form__help">{field.help}</span>
            </label>
          ))}

          <label className="mp-field">
            <span className="mp-field__label">Email</span>
            <input
              className="mp-field__input"
              type="email"
              value={form.email ?? ''}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="To be added by the studio"
            />
            <span className="mp-adm-form__help">
              No studio email has been confirmed yet, so this stays empty rather than showing
              an invented address.
            </span>
          </label>

          <div className="mp-adm-form__actions">
            <button type="submit" className="mp-adm-btn mp-adm-btn--primary">
              Save draft
            </button>
          </div>
        </form>

        <div className="mp-adm-hint mp-adm-hint--quiet">
          <p className="mp-adm-hint__title">Draft only in this phase</p>
          <p className="mp-adm-hint__text">
            {savedAt
              ? `Draft saved locally on this device at ${savedAt.toLocaleTimeString('en-IN')}. `
              : 'Drafts are stored on this device only. '}
            The live website keeps reading its configured contact details; switching it to these
            values is a separate, deliberate step. No passwords or keys belong here.
          </p>
        </div>

        <form className="mp-adm-form mp-adm-settings__block">
          <h2 className="mp-adm-settings__heading">Opening animation</h2>
          <p className="mp-adm-form__help">
            Controls the brand intro on the public website. Applies on this device immediately.
          </p>
          <div className="mp-adm-settings__options" role="radiogroup" aria-label="Opening animation">
            {INTRO_OPTIONS.map((option) => (
              <label key={option.value} className="mp-adm-settings__option">
                <input
                  type="radio"
                  name="intro-mode"
                  value={option.value}
                  checked={introMode === option.value}
                  onChange={() => applyIntroMode(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </form>

        <div className="mp-adm-settings__block">
          <h2 className="mp-adm-settings__heading">Default gallery permissions</h2>
          <p className="mp-adm-form__help">
            Every new event starts with these permissions; each event can then be changed
            individually on its event page. Watermark, download and like/dislike start on, face
            scan starts off, and the Instagram gate starts on.
          </p>
          <ul className="mp-adm-settings__defaults">
            {PERMISSION_DEFAULTS.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                <span className="mp-adm-badge mp-adm-badge--active">{item.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
