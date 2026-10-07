/** Public plan catalog shown at signup (mirrors seeded `billing.Plan` rows). */

export type SignupPlanOption = {
  code: 'free' | 'starter' | 'growth' | 'pro'
  name: string
  priceClp: number
  productLimit: number | null
  aiAssistedEnabled: boolean
  summary: string
}

export const SIGNUP_PLAN_OPTIONS: SignupPlanOption[] = [
  {
    code: 'free',
    name: 'Gratis',
    priceClp: 0,
    productLimit: 5,
    aiAssistedEnabled: false,
    summary: 'Hasta 5 productos · solo carga manual',
  },
  {
    code: 'starter',
    name: 'Starter',
    priceClp: 4990,
    productLimit: 15,
    aiAssistedEnabled: true,
    summary: 'Hasta 15 productos · creación asistida',
  },
  {
    code: 'growth',
    name: 'Growth',
    priceClp: 9990,
    productLimit: 25,
    aiAssistedEnabled: true,
    summary: 'Hasta 25 productos · creación asistida',
  },
  {
    code: 'pro',
    name: 'Pro',
    priceClp: 14990,
    productLimit: null,
    aiAssistedEnabled: true,
    summary: 'Productos ilimitados · creación asistida',
  },
]

export const SIGNUP_PLAN_STORAGE_KEY = 'tenda.signup.planCode'

export function formatSignupPlanPrice(priceClp: number): string {
  if (priceClp <= 0) return 'Gratis'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(priceClp)
}
