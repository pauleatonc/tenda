import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewerPayload } from '../../auth/api'
import { ProfilePage } from '../ProfilePage'

const { graphqlRequest, uploadPrivateFile } = vi.hoisted(() => ({
  graphqlRequest: vi.fn(),
  uploadPrivateFile: vi.fn(),
}))

vi.mock('../../lib/http', async () => {
  const actual = await vi.importActual<typeof import('../../lib/http')>('../../lib/http')
  return { ...actual, graphqlRequest }
})

vi.mock('../../inventory/api', () => ({
  uploadPrivateFile: (...args: unknown[]) => uploadPrivateFile(...args),
}))

function viewer(canManageStore: boolean): ViewerPayload {
  return {
    viewer: {
      id: 'user-1',
      email: 'ana@tenda.cl',
      emailVerified: true,
      profile: {
        id: 'profile-1',
        fullName: 'Ana Pérez',
        phone: '+56911111111',
        locale: 'es-CL',
        photoUrl: null,
      },
    },
    organisation: {
      id: 'org-1',
      name: 'Taller Ana',
      timezone: 'America/Santiago',
      phone: '',
      businessEmail: 'ana@tenda.cl',
      address: 'Italia 100',
      description: 'Cerámica',
      logoUrl: null,
    },
    inventory: { id: 'inv-1', name: 'Principal' },
    membership: {
      id: 'membership-1',
      role: canManageStore ? 'owner' : 'operator',
      roleLabel: canManageStore ? 'titular' : 'equipo',
      permissions: {
        viewFinancials: canManageStore,
        manageMembers: canManageStore,
        manageSensitiveConfiguration: canManageStore,
        manageInventorySchema: canManageStore,
      },
    },
  }
}

function renderPage(context: ViewerPayload) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Shell({ children }: { children?: ReactNode }) {
    return <>{children ?? <Outlet context={context} />}</>
  }
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/configuracion']}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/app/configuracion" element={<ProfilePage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProfilePage', () => {
  beforeEach(() => {
    graphqlRequest.mockReset()
    uploadPrivateFile.mockReset()
  })

  it('muestra datos de la persona y de la tienda', () => {
    renderPage(viewer(true))
    expect(screen.getByDisplayValue('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Taller Ana')).toBeInTheDocument()
    expect(screen.getByText('titular')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar tienda' })).toBeInTheDocument()
  })

  it('oculta la edición de tienda si no hay permiso', () => {
    renderPage(viewer(false))
    expect(screen.queryByRole('button', { name: 'Guardar tienda' })).not.toBeInTheDocument()
    expect(
      screen.getByText('Solo quien titula la tienda puede editar estos datos.'),
    ).toBeInTheDocument()
  })

  it('guarda el perfil', async () => {
    graphqlRequest.mockResolvedValue({
      updateProfile: {
        profile: {
          id: 'profile-1',
          fullName: 'Ana Pérez',
          phone: '',
          locale: 'es-CL',
          photoUrl: null,
        },
      },
    })
    renderPage(viewer(true))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }))
    expect(graphqlRequest).toHaveBeenCalled()
  })
})
