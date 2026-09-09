export const PRODUCT_CREATE_OPTIONS = [
  {
    origin: 'manual',
    title: 'Carga manual',
    description: 'Completa todos los datos del producto.',
    to: '/app/inventario/nuevo/manual',
  },
  {
    origin: 'variant',
    title: 'Agregar variante a un producto existente',
    description: 'Parte de un producto y cambia al menos un dato.',
    to: '/app/inventario/nuevo/variante',
  },
  {
    origin: 'assisted',
    title: 'Creación asistida',
    description:
      'Sube o toma una foto. Por ahora los datos quedan vacíos para que los completes.',
    to: '/app/inventario/nuevo/asistida',
  },
] as const

export type ProductCreateOrigin = (typeof PRODUCT_CREATE_OPTIONS)[number]['origin']
