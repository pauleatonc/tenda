import { CHILE_REGIONS, chileCommunes } from '@tenda/api-client'

export function ChileLocationFields({
  regionId,
  communeId,
  region,
  commune,
  onChange,
  regionError,
  communeError,
  disabled = false,
}: {
  regionId: string
  communeId: string
  region: string
  commune: string
  onChange: (next: { region: string; commune: string }) => void
  regionError?: string
  communeError?: string
  disabled?: boolean
}) {
  const communes = chileCommunes(region)
  const communeDisabled = disabled || !region

  return (
    <div className="chile-location">
      <div className="field">
        <label htmlFor={regionId}>Región</label>
        <select
          id={regionId}
          className={region ? undefined : 'field__select--empty'}
          value={region}
          disabled={disabled}
          aria-invalid={Boolean(regionError)}
          onChange={(event) => {
            const nextRegion = event.target.value
            onChange({
              region: nextRegion,
              commune: chileCommunes(nextRegion).includes(commune) ? commune : '',
            })
          }}
        >
          <option value="">Selecciona una región</option>
          {CHILE_REGIONS.map((item) => (
            <option key={item.region} value={item.region}>
              {item.region}
            </option>
          ))}
        </select>
        {regionError ? <small className="field__error">{regionError}</small> : null}
      </div>
      <div className="field">
        <label htmlFor={communeId}>Comuna</label>
        <select
          id={communeId}
          className={commune ? undefined : 'field__select--empty'}
          value={commune}
          disabled={communeDisabled}
          aria-invalid={Boolean(communeError)}
          onChange={(event) => onChange({ region, commune: event.target.value })}
        >
          <option value="">{region ? 'Selecciona una comuna' : 'Primero elige la región'}</option>
          {communes.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {communeError ? <small className="field__error">{communeError}</small> : null}
      </div>
    </div>
  )
}
