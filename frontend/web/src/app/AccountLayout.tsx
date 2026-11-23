import { Outlet, useOutletContext } from 'react-router-dom'

import type { ViewerPayload } from '../auth/api'

export function AccountLayout() {
  const viewer = useOutletContext<ViewerPayload>()
  return <Outlet context={viewer} />
}
