import { productDraftEquals, suggestVariantName } from '../product-draft'

const base = {
  name: 'Polera',
  catalogStatus: 'active',
  purchasePrice: '2000',
  salePrice: '5000',
  extraAttributes: { talla: 'M' },
}

describe('productDraftEquals', () => {
  it('ignora mayúsculas y espacios en el nombre', () => {
    expect(productDraftEquals(base, { ...base, name: '  POLERA  ' })).toBe(true)
  })

  it('detecta un atributo distinto', () => {
    expect(
      productDraftEquals(base, { ...base, extraAttributes: { talla: 'L' } }),
    ).toBe(false)
  })
})

describe('suggestVariantName', () => {
  it('compone un nombre con el dato cambiado', () => {
    expect(suggestVariantName('Polera', 'L')).toBe('Polera · L')
  })
})
