import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { fetchPaymentConnection, salesKeys } from '../sales/api'

export function MercadoPagoProfileCard() {
  const connection = useQuery({
    queryKey: salesKeys.paymentConnection(),
    queryFn: fetchPaymentConnection,
  })
  const status = connection.data?.sellerPaymentConnection?.status ?? ''
  const enabled = ['active', 'connected'].includes(status)

  return (
    <section className="profile-card profile-card--wide" aria-labelledby="mp-title">
      <div className="profile-card__intro">
        <div className="profile-bank-mark" aria-hidden="true">
          MP
        </div>
        <div>
          <h2 id="mp-title">Pago con Mercado Pago</h2>
          <p>
            Conecta tu cuenta para ofrecer Pago Online. El comprador paga en Mercado Pago
            desde el enlace de Tenda.
          </p>
        </div>
        <span className={`profile-bank-status${enabled ? ' is-ready' : ''}`}>
          {connection.isPending ? 'Consultando…' : enabled ? 'Habilitado' : 'No habilitado'}
        </span>
      </div>
      <Link className="button button--primary" to="/app/configuracion/pagos">
        Configuración de pago con Mercado Pago
      </Link>
    </section>
  )
}
