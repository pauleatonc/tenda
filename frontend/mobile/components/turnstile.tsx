import { useEffect } from 'react'

import { mobileTurnstileEnabled, turnstileSiteKey } from './turnstile-config'

export { mobileTurnstileEnabled } from './turnstile-config'

export function MobileTurnstile({ onToken }: { onToken: (token: string) => void }) {
  useEffect(() => {
    if (!turnstileSiteKey()) onToken('local-development')
  }, [onToken])

  if (!mobileTurnstileEnabled()) return null
  return null
}
