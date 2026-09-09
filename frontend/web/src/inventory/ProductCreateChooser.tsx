import { Link } from 'react-router-dom'

import { PRODUCT_CREATE_OPTIONS } from './create-options'

export function ProductCreateChooser() {
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Inventario</p>
          <h1>Agregar producto</h1>
          <p>Elige cómo quieres registrar el producto.</p>
        </div>
      </header>

      <section className="create-chooser" aria-label="Formas de agregar un producto">
        {PRODUCT_CREATE_OPTIONS.map((option) => (
          <Link key={option.origin} className="create-chooser__card" to={option.to}>
            <h2>{option.title}</h2>
            <p>{option.description}</p>
          </Link>
        ))}
      </section>
    </>
  )
}
