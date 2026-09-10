// Source: https://juanbrujo.github.io/chile-regiones-comunas/data/original-simple.json
import catalog from './data/chile-regiones-comunas.json' with { type: 'json' }

export type ChileRegion = {
  region: string
  communes: readonly string[]
}

const REGIONS: readonly ChileRegion[] = catalog.regiones.map((item) => ({
  region: item.region,
  communes: item.comunas,
}))

const COMMUNES_BY_REGION = new Map(
  REGIONS.map((item) => [item.region, new Set(item.communes)]),
)

export const CHILE_REGIONS = REGIONS

export function chileCommunes(region: string): readonly string[] {
  return REGIONS.find((item) => item.region === region)?.communes ?? []
}

export function isValidChileLocation(region: string, commune: string): boolean {
  return Boolean(COMMUNES_BY_REGION.get(region.trim())?.has(commune.trim()))
}

export function formatChileAddress(
  addressLine: string,
  commune: string,
  region: string,
): string {
  return [addressLine, commune, region]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ')
}
