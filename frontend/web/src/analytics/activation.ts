import { AnalyticsEvents, getAnalytics } from './client'

const ACTIVATION_KEY = 'tenda.analytics.activation_completed'
const FLAGS_KEY = 'tenda.analytics.activation_flags'

type ActivationFlags = {
  product: boolean
  payments: boolean
  salePublished: boolean
}

function readFlags(): ActivationFlags {
  try {
    const raw = localStorage.getItem(FLAGS_KEY)
    if (!raw) return { product: false, payments: false, salePublished: false }
    const parsed = JSON.parse(raw) as Partial<ActivationFlags>
    return {
      product: Boolean(parsed.product),
      payments: Boolean(parsed.payments),
      salePublished: Boolean(parsed.salePublished),
    }
  } catch {
    return { product: false, payments: false, salePublished: false }
  }
}

function writeFlags(flags: ActivationFlags): void {
  localStorage.setItem(FLAGS_KEY, JSON.stringify(flags))
}

/** Marks an activation milestone and fires `activation_completed` once when all are met. */
export function markActivationFlag(flag: keyof ActivationFlags): void {
  if (localStorage.getItem(ACTIVATION_KEY) === '1') return
  const flags = readFlags()
  if (flags[flag]) {
    maybeComplete(flags)
    return
  }
  const next = { ...flags, [flag]: true }
  writeFlags(next)
  maybeComplete(next)
}

function maybeComplete(flags: ActivationFlags): void {
  if (!flags.product || !flags.payments || !flags.salePublished) return
  if (localStorage.getItem(ACTIVATION_KEY) === '1') return
  getAnalytics().track(AnalyticsEvents.activationCompleted)
  localStorage.setItem(ACTIVATION_KEY, '1')
}
