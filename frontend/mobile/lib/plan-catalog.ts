export type SignupPlanOption = {
  code: 'free' | 'starter' | 'growth' | 'pro'
  name: string
  priceClp: number
  summary: string
}

export const SIGNUP_PLAN_OPTIONS: SignupPlanOption[] = [
  {
    code: 'free',
    name: 'Gratis',
    priceClp: 0,
    summary: 'Hasta 5 productos · solo carga manual',
  },
  {
    code: 'starter',
    name: 'Starter',
    priceClp: 4990,
    summary: 'Hasta 15 productos · creación asistida',
  },
  {
    code: 'growth',
    name: 'Growth',
    priceClp: 9990,
    summary: 'Hasta 25 productos · creación asistida',
  },
  {
    code: 'pro',
    name: 'Pro',
    priceClp: 14990,
    summary: 'Productos ilimitados · creación asistida',
  },
]

export function formatSignupPlanPrice(priceClp: number): string {
  if (priceClp <= 0) return 'Gratis'
  return `$${priceClp.toLocaleString('es-CL')} CLP/mes`
}
