import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'

type SearchFieldProps = {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
}

export function SearchField({
  value,
  onChange,
  label = 'Buscar',
  placeholder = 'Buscar…',
}: SearchFieldProps) {
  const id = useId()
  return (
    <div className="search-field">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <span aria-hidden="true">⌕</span>
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button type="button" onClick={() => onChange('')} aria-label="Limpiar búsqueda">
          ×
        </button>
      ) : null}
    </div>
  )
}

const statusLabels: Record<string, string> = {
  active: 'Activo',
  available: 'Disponible',
  reserved: 'Reservado',
  pending: 'Pendiente',
  success: 'Completado',
  warning: 'Requiere atención',
  error: 'Con problema',
  coming_soon: 'Próximamente',
}

export function StatusChip({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`status-chip status-chip--${status}`}>
      {label ?? statusLabels[status] ?? status}
    </span>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <section className="empty-state">
      <span aria-hidden="true">◇</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  )
}

export function FormErrorSummary({
  errors,
}: {
  errors: Record<string, string | undefined>
}) {
  const entries = Object.entries(errors).filter((entry): entry is [string, string] =>
    Boolean(entry[1]),
  )
  if (!entries.length) return null
  return (
    <div className="form-error-summary" role="alert" tabIndex={-1}>
      <strong>Revisa los campos indicados</strong>
      <ul>
        {entries.map(([field, message]) => (
          <li key={field}>
            <a href={`#${field}`}>{message}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function UploadField({
  label,
  accept,
  onSelect,
  disabled = false,
}: {
  label: string
  accept: string
  onSelect: (file: File) => void
  disabled?: boolean
}) {
  const id = useId()
  const [fileName, setFileName] = useState('')
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    onSelect(file)
  }
  return (
    <div className="upload-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
      />
      <span>{fileName || 'Selecciona o arrastra un archivo'}</span>
    </div>
  )
}

type TimelineItem = {
  id: string
  title: string
  detail?: string
  date?: string
  status?: string
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="timeline">
      {items.map((item) => (
        <li key={item.id}>
          <span className="timeline__marker" aria-hidden="true" />
          <div>
            <strong>{item.title}</strong>
            {item.detail ? <p>{item.detail}</p> : null}
            {item.date ? <time>{item.date}</time> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

/**
 * Modal dialog with the minimum accessible behaviour the spec asks for:
 * labelled by its title, closed with Escape and focused on open.
 */
export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  size = 'medium',
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'medium' | 'large'
}) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        ref={panelRef}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </div>
    </div>
  )
}

export function ConnectivityBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const markOnline = () => setOnline(true)
    const markOffline = () => setOnline(false)
    window.addEventListener('online', markOnline)
    window.addEventListener('offline', markOffline)
    return () => {
      window.removeEventListener('online', markOnline)
      window.removeEventListener('offline', markOffline)
    }
  }, [])
  if (online) return null
  return (
    <div className="connectivity-banner" role="status">
      Sin conexión. Conservaremos este formulario mientras permanezca abierto, pero no
      enviaremos cambios hasta recuperar internet.
    </div>
  )
}
