import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom'

import { getViewer, logout, TendaApiError, type ViewerPayload } from '../auth/api'
import { ConnectivityBanner, EmptyState, StatusChip } from '../components/ui'
import { InventorySummary } from '../inventory/InventorySummary'
import { SalesAttentionSummary } from '../sales/SalesAttentionSummary'

type NavItem = {
  to: string
  label: string
  icon: string
  financial?: boolean
}

const navigation: NavItem[] = [
  { to: '/app', label: 'Inicio', icon: '⌂' },
  { to: '/app/inventario', label: 'Inventario', icon: '□' },
  { to: '/app/ventas', label: 'Ventas', icon: '↗' },
  { to: '/app/despachos', label: 'Despachos', icon: '◇' },
  { to: '/app/balances', label: 'Balances', icon: '◒', financial: true },
  { to: '/app/mas', label: 'Más', icon: '•••' },
]

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
  })

  useEffect(() => {
    window.localStorage.setItem('tenda.sidebar.collapsed', String(collapsed))
  }, [collapsed])

  if (viewer.isPending) return <ShellLoading />
  if (viewer.isError) return <ShellError error={viewer.error} />

  const data = viewer.data
  const visibleNavigation = navigation.filter(
    (item) => !item.financial || data.membership.permissions.viewFinancials,
  )

  return (
    <div className={`app-shell ${collapsed ? 'app-shell--collapsed' : ''}`}>
      <ConnectivityBanner />
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
          {visibleNavigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/app'}
              title={collapsed ? item.label : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="app-sidebar__account">
          <span className="avatar" aria-hidden="true">
            {(data.viewer.profile.fullName || data.viewer.email)
              .slice(0, 1)
              .toUpperCase()}
          </span>
          <div>
            <strong>{data.viewer.profile.fullName || data.viewer.email}</strong>
            <small>{data.membership.role}</small>
          </div>
        </div>
      </aside>

      <div className="app-workspace">
        <header className="app-header">
          <div>
            <small>Tienda</small>
            <strong>{data.organisation.name}</strong>
          </div>
          <div className="app-header__actions">
            <button type="button" aria-label="Notificaciones" title="Notificaciones">
              ♢
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true)
                try {
                  await logout()
                  queryClient.removeQueries({ queryKey: ['viewer'] })
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

      <section className="dashboard-grid" aria-label="Próximas acciones">
        {!data.viewer.emailVerified ? (
          <article className="attention-card attention-card--warning">
            <div>
              <StatusChip status="warning" label="Cuenta" />
              <h2>Verifica tu correo</h2>
              <p>Confirma tu email para proteger la cuenta y recuperar el acceso.</p>
            </div>
            <Link to="/verificar-email">Verificar ahora</Link>
          </article>
        ) : (
          <article className="attention-card">
            <div>
              <StatusChip status="success" label="Cuenta protegida" />
              <h2>Todo listo para comenzar</h2>
              <p>Agrega tu primer producto para activar el resumen de inventario.</p>
            </div>
            <Link to="/app/inventario">Ir a inventario</Link>
          </article>
        )}

        <InventorySummary />

        <SalesAttentionSummary />

        <article className="context-card">
          <span>Tu contexto</span>
          <strong>{data.organisation.name}</strong>
          <p>
            Rol: <b>{data.membership.role}</b>
          </p>
          <p>
            Finanzas:{' '}
            <b>
              {data.membership.permissions.viewFinancials
                ? 'habilitadas'
                : 'restringidas'}
            </b>
          </p>
        </article>
      </section>
    </>
  )
}

export function SectionPlaceholder({
  title,
  description,
  stage,
}: {
  title: string
  description: string
  stage: string
}) {
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">{stage}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </header>
      <EmptyState
        title={`${title} está preparado`}
        description="La navegación y los estados base ya están disponibles. El contenido de dominio se habilita en su paquete funcional."
        action={<StatusChip status="coming_soon" />}
      />
    </>
  )
}

export function BalancesPlaceholder() {
  const data = useViewerContext()
  if (!data.membership.permissions.viewFinancials) {
    return (
      <>
        <header className="page-heading">
          <div>
            <p className="eyebrow">Permiso requerido</p>
            <h1>Balances</h1>
          </div>
        </header>
        <EmptyState
          title="No tienes acceso a información financiera"
          description="Un Owner puede habilitar el permiso view_financials para tu membresía."
        />
      </>
    )
  }
  return (
    <SectionPlaceholder
      title="Balances"
      description="Resumen comercial basado en ventas confirmadas."
      stage="Etapa 2"
    />
  )
}

export function MorePage() {
  const data = useViewerContext()
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Cuenta y negocio</p>
          <h1>Más</h1>
          <p>Administra tu perfil, Tienda y preferencias.</p>
        </div>
      </header>
      <div className="settings-list">
        <Link to="/app/configuracion">
          <span>Perfil y negocio</span>
          <small>{data.viewer.email}</small>
        </Link>
        {data.membership.role === 'owner' ||
        data.membership.permissions.manageSensitiveConfiguration ? (
          <Link to="/app/configuracion/pagos">
            <span>Pagos</span>
            <small>Conexión Mercado Pago</small>
          </Link>
        ) : null}
        {data.membership.permissions.viewFinancials ? (
          <Link to="/app/balances">
            <span>Balances</span>
            <small>Solo información comercial</small>
          </Link>
        ) : null}
        <div aria-disabled="true">
          <span>Asistente con foto</span>
          <StatusChip status="coming_soon" />
        </div>
      </div>
    </>
  )
}
