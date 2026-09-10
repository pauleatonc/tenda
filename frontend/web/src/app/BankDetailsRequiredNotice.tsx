import { Link } from 'react-router-dom'

import { BANK_DETAILS_REQUIRED_MESSAGE } from '@tenda/api-client'

export function BankDetailsRequiredNotice({
  to = '/app/configuracion',
}: {
  to?: string
}) {
  return (
    <div className="bank-details-required" role="status">
      <div>
        <strong>Faltan datos bancarios</strong>
        <p>{BANK_DETAILS_REQUIRED_MESSAGE}</p>
      </div>
      <Link className="button button--primary" to={to}>
        Agregar datos bancarios
      </Link>
    </div>
  )
}
