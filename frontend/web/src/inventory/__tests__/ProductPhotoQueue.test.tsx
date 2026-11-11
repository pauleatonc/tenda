import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ProductPhotoQueue } from '../ProductPhotoQueue'

const originalUserAgent = navigator.userAgent

function setUserAgent(value: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value,
  })
}

afterEach(() => {
  setUserAgent(originalUserAgent)
})

function renderQueue() {
  render(
    <ProductPhotoQueue
      photos={[]}
      captureOnPhone
      required
      onAdd={() => undefined}
      onRemove={() => undefined}
    />,
  )
}

describe('ProductPhotoQueue', () => {
  it('en el computador abre el selector de archivos', () => {
    setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0')
    renderQueue()
    const input = screen.getByLabelText('Subir fotos')
    expect(input).not.toHaveAttribute('capture')
    expect(input).toHaveAttribute('multiple')
  })

  it('en un celular abre la cámara trasera', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    )
    renderQueue()
    const input = screen.getByLabelText('Tomar foto')
    expect(input).toHaveAttribute('capture', 'environment')
    expect(input).not.toHaveAttribute('multiple')
  })
})
