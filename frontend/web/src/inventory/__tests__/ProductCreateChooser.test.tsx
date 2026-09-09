import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { ProductCreateChooser } from '../ProductCreateChooser'

describe('ProductCreateChooser', () => {
  it('ofrece las tres formas de agregar un producto', () => {
    render(
      <MemoryRouter>
        <ProductCreateChooser />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Agregar producto' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Carga manual/ })).toHaveAttribute(
      'href',
      '/app/inventario/nuevo/manual',
    )
    expect(
      screen.getByRole('link', { name: /Agregar variante a un producto existente/ }),
    ).toHaveAttribute('href', '/app/inventario/nuevo/variante')
    expect(screen.getByRole('link', { name: /Creación asistida/ })).toHaveAttribute(
      'href',
      '/app/inventario/nuevo/asistida',
    )
  })
})
