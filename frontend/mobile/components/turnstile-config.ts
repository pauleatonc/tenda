const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? ''

export function turnstileSiteKey() {
  return SITE_KEY
}

export function mobileTurnstileEnabled() {
  return Boolean(SITE_KEY)
}
