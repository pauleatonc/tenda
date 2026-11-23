import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
} from 'react-router-dom'

import { getAnalytics } from '../analytics'
import { getViewer, logout, TendaApiError, type ViewerPayload } from '../auth/api'
import { billingKeys, fetchOrganisationBilling } from '../billing/api'
import { SLOW_QUERY_STALE_MS } from '../lib/queryDefaults'
import { AuthenticatedImage, PersonAvatar } from '../components/AuthenticatedImage'
import { SectionIcon, type SectionIconName } from '../components/section-icons'
import { ConnectivityBanner, StatusChip } from '../components/ui'
import { InventorySummary } from '../inventory/InventorySummary'
import { SalesAttentionSummary } from '../sales/SalesAttentionSummary'
import { ShippingHomeSummary } from '../shipping/ShippingHomeSummary'

type NavItem = {
  to: string
  label: string
  icon: SectionIconName
  financial?: boolean
}

const navigation: NavItem[] = [
  { to: '/app', label: 'Inicio', icon: 'home' },
  { to: '/app/inventario', label: 'Inventario', icon: 'inventory' },
  { to: '/app/ventas', label: 'Ventas', icon: 'sales' },
  { to: '/app/despachos', label: 'Despachos', icon: 'shipping' },
  { to: '/app/balances', label: 'Balances', icon: 'balances', financial: true },
  { to: '/app/cuenta', label: 'Cuenta', icon: 'more' },
]

const accountSections = [
  { to: '/app/cuenta/perfil', label: 'Perfil empresa', end: true },
  { to: '/app/cuenta/plan', label: 'Plan', end: false },
  { to: '/app/cuenta/pagos', label: 'Integración de pago', end: false },
  { to: '/app/cuenta/cuentas', label: 'Cuentas bancarias', end: false },
] as const

function accountMenuFitsSidebar() {
  return window.matchMedia?.('(min-width: 581px)').matches ?? true
}

function AccountNav({
  collapsed,
  canManage,
  onExpand,
}: {
  collapsed: boolean
  canManage: boolean
  onExpand: () => void
}) {
  const location = useLocation()
  const onAccount = location.pathname.startsWith('/app/cuenta')
  const [open, setOpen] = useState(() => onAccount && accountMenuFitsSidebar())
  const sections = canManage
    ? accountSections
    : accountSections.filter((section) => section.to.endsWith('/perfil'))

  useEffect(() => {
    if (onAccount && accountMenuFitsSidebar()) setOpen(true)
  }, [onAccount])

  return (
    <div className={`nav-group${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className={onAccount ? 'active' : undefined}
        aria-expanded={open}
        aria-controls="account-sections"
        title={collapsed ? 'Cuenta' : undefined}
        onClick={() => {
          if (collapsed) {
            onExpand()
            setOpen(true)
            return
          }
          setOpen((current) => !current)
        }}
      >
        <span className="nav-icon">
          <SectionIcon name="more" />
        </span>
        <span>Cuenta</span>
      </button>
      {open ? (
        <div className="nav-group__menu" id="account-sections">
          {sections.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              end={section.end}
              onClick={() => {
                if (!accountMenuFitsSidebar()) setOpen(false)
              }}
            >
              <span>{section.label}</span>
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ShellLoading() {
  return (
    <main className="shell-state" aria-live="polite">
      <span className="wordmark">tenda</span>
      <div className="shell-state__skeleton" />
      <p>Preparando tu espacio de trabajo…</p>
    </main>
  )
}

function ShellError({ error }: { error: Error }) {
  const unauthenticated =
    error instanceof TendaApiError && error.code === 'AUTHENTICATION_REQUIRED'
  return (
    <main className="shell-state">
      <span className="wordmark">tenda</span>
      <h1>{unauthenticated ? 'Tu sesión terminó' : 'No pudimos cargar tu cuenta'}</h1>
      <p>{error.message}</p>
      <Link className="button button--primary" to={unauthenticated ? '/login' : '/app'}>
        {unauthenticated ? 'Iniciar sesión' : 'Reintentar'}
      </Link>
    </main>
  )
}

export function ApplicationShell() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [collapsed, setCollapsed] = useState(
    () => window.localStorage.getItem('tenda.sidebar.collapsed') === 'true',
  )
  const [loggingOut, setLoggingOut] = useState(false)
  const viewer = useQuery({
    queryKey: ['viewer'],
    queryFn: getViewer,
    retry: false,
    staleTime: SLOW_QUERY_STALE_MS,
  })
  const billing = useQuery({
    queryKey: billingKeys.organisation(),
    queryFn: fetchOrganisationBilling,
    enabled: viewer.isSuccess,
    staleTime: SLOW_QUERY_STALE_MS,
  })

  useEffect(() => {
    window.localStorage.setItem('tenda.sidebar.collapsed', String(collapsed))
  }, [collapsed])

  useEffect(() => {
    const data = viewer.data
    if (!data) return
    const analytics = getAnalytics()
    analytics.setUser(data.viewer.id)
    analytics.setUserProperties({
      role: data.membership.role,
      organisation_id: data.organisation.id,
      has_bank_details: data.organisation.hasBankDetails ? 'true' : 'false',
    })
  }, [viewer.data])

  if (viewer.isPending || (viewer.isSuccess && billing.isPending)) return <ShellLoading />
  if (viewer.isError) return <ShellError error={viewer.error} />
  if (billing.data?.needsPlanSelection) {
    return <Navigate to="/elige-plan" replace />
  }

  const data = viewer.data
  const visibleNavigation = navigation.filter(
    (item) => !item.financial || data.membership.permissions.viewFinancials,
  )

  const storeInitial = (data.organisation.name || 'T').slice(0, 1).toUpperCase()

  return (
    <div className={`app-shell ${collapsed ? 'app-shell--collapsed' : ''}`}>
      <ConnectivityBanner />
      <div className="app-shell__body">
        <aside className="app-sidebar">
          <div className="app-sidebar__brand">
            <Link className="wordmark" to="/app" aria-label="Tenda, inicio">
              tenda
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'Expandir navegación' : 'Contraer navegación'}
              aria-expanded={!collapsed}
            >
              {collapsed ? '›' : '‹'}
            </button>
          </div>
          <nav aria-label="Aplicación">
            {visibleNavigation.map((item) =>
              item.to === '/app/cuenta' ? (
                <AccountNav
                  key={item.to}
                  collapsed={collapsed}
                  canManage={
                    data.membership.role === 'owner' ||
                    data.membership.permissions.manageSensitiveConfiguration
                  }
                  onExpand={() => setCollapsed(false)}
                />
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/app'}
                  title={collapsed ? item.label : undefined}
                  className={item.financial ? 'nav-financial' : undefined}
                >
                  <span className="nav-icon">
                    <SectionIcon name={item.icon} />
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              ),
            )}
            {data.viewer.isStaff ? (
              <NavLink
                to="/app/plataforma"
                className="nav-staff"
                title={collapsed ? 'Plataforma' : undefined}
              >
                <span className="nav-icon">
                  <SectionIcon name="platform" />
                </span>
                <span>Plataforma</span>
              </NavLink>
            ) : null}
          </nav>
          <Link
            className="app-sidebar__account"
            to="/app/cuenta/perfil"
            aria-label="Tu cuenta"
            title="Tu cuenta"
          >
            <PersonAvatar
              name={data.viewer.profile.fullName || data.viewer.email}
              photoUrl={data.viewer.profile.photoUrl}
            />
            <div>
              <strong>{data.viewer.profile.fullName || data.viewer.email}</strong>
              <small>{data.membership.roleLabel}</small>
            </div>
          </Link>
        </aside>

        <div className="app-workspace">
          <header className="app-header">
            <Link className="app-header__store" to="/app/cuenta/perfil">
              <span className="store-logo" aria-hidden="true">
                <span className="store-logo__fallback">{storeInitial}</span>
                {data.organisation.logoUrl ? (
                  <AuthenticatedImage
                    src={data.organisation.logoUrl}
                    alt=""
                    className="store-logo__img"
                  />
                ) : null}
              </span>
              <div>
                <small>Tienda</small>
                <strong>{data.organisation.name}</strong>
              </div>
            </Link>
            <div className="app-header__actions">
              <button type="button" aria-label="Notificaciones" title="Notificaciones">
                <SectionIcon name="bell" size={20} />
              </button>
              <button
                className="button button--secondary"
                type="button"
                disabled={loggingOut}
                onClick={async () => {
                  setLoggingOut(true)
                  try {
                    await logout()
                    queryClient.clear()
                    navigate('/login', { replace: true })
                  } finally {
                    setLoggingOut(false)
                  }
                }}
              >
                {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
              </button>
            </div>
          </header>
          <main className="app-content">
            <Outlet context={data} />
          </main>
        </div>
      </div>
    </div>
  )
}

function useViewerContext() {
  return useOutletContext<ViewerPayload>()
}

export function DashboardPage() {
  const data = useViewerContext()
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">{data.inventory.name}</p>
          <h1>Hola, {data.viewer.profile.fullName || data.viewer.email}</h1>
          <p>Estas son las acciones que requieren tu atención.</p>
        </div>
      </header>

      <section className="dashboard-grid" aria-label="Resumen del negocio">
        {!data.viewer.emailVerified ? (
          <article className="attention-card attention-card--warning">
            <div>
              <StatusChip status="warning" label="Cuenta" />
              <h2>Verifica tu correo</h2>
              <p>Confirma tu email para proteger la cuenta y recuperar el acceso.</p>
            </div>
            <Link to="/verificar-email">Verificar ahora</Link>
          </article>
        ) : null}

        <InventorySummary />

        <SalesAttentionSummary />

        <ShippingHomeSummary />
      </section>
    </>
  )
}

