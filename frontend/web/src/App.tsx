import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import { LoginPage, RecoveryPage, RegisterPage, VerificationPage } from './auth/AuthPages'
import {
  ApplicationShell,
  DashboardPage,
  MorePage,
} from './app/AppShell'
import { ProfilePage } from './app/ProfilePage'
import './app/profile.css'
import { ContactPage } from './public/ContactPage'
import { InventoryListPage } from './inventory/InventoryListPage'
import { InventoryExportsPage } from './inventory/InventoryExportsPage'
import { InventoryImportPage } from './inventory/InventoryImportPage'
import { ProductDetailPage } from './inventory/ProductDetailPage'
import { ProductFormPage } from './inventory/ProductFormPage'
import { PublicCheckoutPage } from './public/PublicCheckoutPage'
import { PublicOrderPage } from './public/PublicOrderPage'
import { PublicProofPage } from './public/PublicProofPage'
import { PublicShipmentConfirmPage } from './public/PublicShipmentConfirmPage'
import { PublicShipmentHelpPage } from './public/PublicShipmentHelpPage'
import { PublicShipmentPage } from './public/PublicShipmentPage'
import { PublicStatusPage } from './public/PublicStatusPage'
import { BalancesPage } from './sales/BalancesPage'
import { NewSalePage } from './sales/NewSalePage'
import { PaymentsSettingsPage } from './sales/PaymentsSettingsPage'
import { ReconciliationsPage } from './sales/ReconciliationsPage'
import { SaleDetailPage } from './sales/SaleDetailPage'
import { SalesListPage } from './sales/SalesListPage'
import { ShipmentDetailPage } from './shipping/ShipmentDetailPage'
import { ShipmentTicketPage } from './shipping/ShipmentTicketPage'
import { ShippingListPage } from './shipping/ShippingListPage'
import './inventory/inventory.css'
import './sales/sales.css'
import './shipping/shipping.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function fetchHealth(): Promise<{ status: string }> {
  const response = await fetch(`${API_URL}/health/live/`)
  if (!response.ok) {
    throw new Error('No fue posible conectar con Tenda')
  }
  return (await response.json()) as { status: string }
}

function HealthPill() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: 1,
  })

  const label = health.isPending
    ? 'Comprobando servicio…'
    : health.isError
      ? 'Servicio no disponible'
      : 'Servicio disponible'

  return (
    <span
      aria-live="polite"
      className={`health-pill ${health.isError ? 'health-pill--error' : ''}`}
    >
      <span className="health-pill__dot" aria-hidden="true" />
      {label}
    </span>
  )
}

function LandingPage() {
  return (
    <main className="landing">
      <nav className="landing__nav" aria-label="Navegación principal">
        <Link className="wordmark" to="/" aria-label="Tenda, inicio">
          tenda
        </Link>
        <div className="landing__nav-actions">
          <Link className="button button--ghost" to="/contacto">
            Contacto
          </Link>
          <Link className="button button--ghost" to="/login">
            Iniciar sesión
          </Link>
          <Link className="button button--dark" to="/registro">
            Crear cuenta
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero__content">
          <p className="eyebrow">Tu negocio merece claridad</p>
          <h1>
            Menos planillas.
            <br />
            Más tiempo para vender.
          </h1>
          <p className="hero__lead">
            Inventario, ventas y despachos en una herramienta simple, diseñada para el día
            a día de tu negocio.
          </p>
          <div className="hero__actions">
            <Link className="button button--primary" to="/registro">
              Comenzar gratis
            </Link>
            <a className="text-link" href="#como-funciona">
              Ver cómo funciona
            </a>
          </div>
          <HealthPill />
        </div>
        <div className="hero__visual" aria-label="Resumen de Tenda">
          <div className="summary-card">
            <div className="summary-card__header">
              <div>
                <span className="summary-card__label">Esta semana</span>
                <strong>$248.000</strong>
              </div>
              <span className="summary-card__trend">+12%</span>
            </div>
            <div className="chart" aria-hidden="true">
              <span style={{ height: '34%' }} />
              <span style={{ height: '56%' }} />
              <span style={{ height: '44%' }} />
              <span style={{ height: '72%' }} />
              <span style={{ height: '61%' }} />
              <span style={{ height: '88%' }} />
              <span style={{ height: '76%' }} />
            </div>
            <div className="summary-card__rows">
              <div>
                <span className="product-dot product-dot--green" />
                <span>Velas de soya</span>
                <strong>18</strong>
              </div>
              <div>
                <span className="product-dot product-dot--clay" />
                <span>Set de tazas</span>
                <strong>7</strong>
              </div>
              <div>
                <span className="product-dot product-dot--gold" />
                <span>Bolsos tejidos</span>
                <strong>12</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="benefits" id="como-funciona">
        <article>
          <span>01</span>
          <h2>Ordena tu inventario</h2>
          <p>Conoce qué tienes disponible y qué necesita tu atención.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Vende con confianza</h2>
          <p>Reserva productos y comparte un enlace de compra seguro.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Acompaña cada despacho</h2>
          <p>Mantén a tu comprador informado hasta la entrega.</p>
        </article>
      </section>
    </main>
  )
}

function ConfigurationPage() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  if (params.has('paymentConnection')) {
    return <Navigate to={`/app/configuracion/pagos${location.search}`} replace />
  }
  return <ProfilePage />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />
      <Route path="/recuperar" element={<RecoveryPage />} />
      <Route path="/verificar-email" element={<VerificationPage />} />
      <Route path="/contacto" element={<ContactPage />} />
      <Route path="/p/:token" element={<PublicOrderPage />} />
      <Route path="/p/:token/comprar" element={<PublicCheckoutPage />} />
      <Route path="/p/:token/comprobante" element={<PublicProofPage />} />
      <Route path="/p/:token/estado" element={<PublicStatusPage />} />
      <Route path="/s/:token" element={<PublicShipmentPage />} />
      <Route path="/s/:token/confirmar" element={<PublicShipmentConfirmPage />} />
      <Route path="/s/:token/consulta" element={<PublicShipmentHelpPage />} />
      <Route path="/app" element={<ApplicationShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="inventario" element={<InventoryListPage />} />
        <Route path="inventario/nuevo" element={<ProductFormPage mode="create" />} />
        <Route path="inventario/importar" element={<InventoryImportPage />} />
        <Route path="inventario/exportaciones" element={<InventoryExportsPage />} />
        <Route path="inventario/:productId" element={<ProductDetailPage />} />
        <Route
          path="inventario/:productId/editar"
          element={<ProductFormPage mode="edit" />}
        />
        <Route path="ventas" element={<SalesListPage />} />
        <Route path="ventas/nueva" element={<NewSalePage />} />
        <Route path="ventas/reconciliaciones" element={<ReconciliationsPage />} />
        <Route path="ventas/:id" element={<SaleDetailPage />} />
        <Route path="despachos" element={<ShippingListPage />} />
        <Route path="despachos/:id" element={<ShipmentDetailPage />} />
        <Route path="despachos/:id/tickets/:ticketId" element={<ShipmentTicketPage />} />
        <Route path="balances" element={<BalancesPage />} />
        <Route path="mas" element={<MorePage />} />
        <Route path="configuracion/pagos" element={<PaymentsSettingsPage />} />
        <Route path="configuracion" element={<ConfigurationPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
