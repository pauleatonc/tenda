export type ProductIdentityDraft = {
  name: string
  catalogStatus: string
  purchasePrice: string | null
  salePrice: string | null
  extraAttributes: Record<string, unknown>
}

function normalizeAttributes(attrs: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const key of Object.keys(attrs).sort()) {
    const value = attrs[key]
    if (value === null || value === undefined || value === '') continue
    next[key] = value
  }
  return next
}

function normalizeIdentityDraft(draft: ProductIdentityDraft): ProductIdentityDraft {
  return {
    name: draft.name.trim().toLocaleLowerCase('es-CL'),
    catalogStatus: draft.catalogStatus,
    purchasePrice: draft.purchasePrice,
    salePrice: draft.salePrice,
    extraAttributes: normalizeAttributes(draft.extraAttributes),
  }
}

/** Identity only: quantity and photos do not distinguish two catalogue rows. */
export function productDraftEquals(
  left: ProductIdentityDraft,
  right: ProductIdentityDraft,
): boolean {
  return (
    JSON.stringify(normalizeIdentityDraft(left)) ===
    JSON.stringify(normalizeIdentityDraft(right))
  )
}

export function suggestVariantName(sourceName: string, changedLabel?: string): string {
  const base = sourceName.trim()
  if (!changedLabel) return base
  return `${base} · ${changedLabel}`.slice(0, 160)
}
