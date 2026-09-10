export const BANK_DETAILS_REQUIRED_MESSAGE =
  'Para poder pedir depósitos debe agregar sus datos bancarios.'

export const CHILEAN_BANKS = [
  'Banco de Chile',
  'BancoEstado',
  'Banco Santander',
  'BCI',
  'Itaú',
  'Scotiabank',
  'Banco Falabella',
  'Banco BICE',
  'Banco Security',
  'Banco Consorcio',
  'Banco Ripley',
  'Banco Internacional',
  'Coopeuch',
  'Tenpo',
  'Mercado Pago',
] as const

export const OTHER_BANK = 'Otro'

export const BANK_ACCOUNT_TYPES = [
  { value: 'cuenta_corriente', label: 'Cuenta corriente' },
  { value: 'cuenta_vista', label: 'Cuenta vista' },
  { value: 'cuenta_ahorro', label: 'Cuenta de ahorro' },
  { value: 'cuenta_rut', label: 'CuentaRUT' },
] as const

export type PublicBankDetails = {
  bankName: string
  accountType: string
  accountTypeLabel: string
  accountNumber: string
  taxId: string
  confirmationEmail: string
}

export type OrganisationBankFields = {
  bankName?: string | null
  bankAccountType?: string | null
  bankAccountNumber?: string | null
  bankHolderTaxId?: string | null
  bankConfirmationEmail?: string | null
  hasBankDetails?: boolean
}

export function organisationHasBankDetails(
  organisation?: OrganisationBankFields | null,
): boolean {
  if (!organisation) return false
  if (typeof organisation.hasBankDetails === 'boolean') {
    return organisation.hasBankDetails
  }
  return Boolean(
    organisation.bankName?.trim() &&
      organisation.bankAccountType?.trim() &&
      organisation.bankAccountNumber?.trim() &&
      organisation.bankHolderTaxId?.trim() &&
      organisation.bankConfirmationEmail?.trim(),
  )
}

export function normalizeRut(value: string): string {
  return value.replace(/[^0-9kK]/g, '').toUpperCase()
}

export function formatRutInput(value: string): string {
  const cleaned = normalizeRut(value).slice(0, 9)
  if (cleaned.length < 2) return cleaned
  const body = cleaned.slice(0, -1)
  const check = cleaned.slice(-1)
  const groups: string[] = []
  let rest = body
  while (rest.length) {
    groups.unshift(rest.slice(-3))
    rest = rest.slice(0, -3)
  }
  return `${groups.join('.')}-${check}`
}

function rutCheckDigit(body: string): string {
  let total = 0
  let factor = 2
  for (const digit of [...body].reverse()) {
    total += Number(digit) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const remainder = 11 - (total % 11)
  if (remainder === 11) return '0'
  if (remainder === 10) return 'K'
  return String(remainder)
}

export function isValidChileanRut(value: string): boolean {
  const cleaned = normalizeRut(value)
  if (cleaned.length < 8) return false
  const body = cleaned.slice(0, -1)
  const check = cleaned.slice(-1)
  if (!/^\d{7,8}$/.test(body)) return false
  return check === rutCheckDigit(body)
}

export function accountTypeLabel(value: string): string {
  return BANK_ACCOUNT_TYPES.find((type) => type.value === value)?.label ?? value
}
