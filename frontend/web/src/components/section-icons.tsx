import type { ReactNode } from 'react'

export type SectionIconName =
  | 'home'
  | 'inventory'
  | 'sales'
  | 'shipping'
  | 'balances'
  | 'more'
  | 'bell'
  | 'search'
  | 'empty'

const marks: Record<SectionIconName, ReactNode> = {
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M6 10.2V20h12V10.2" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  inventory: (
    <>
      <path d="M12 3.5 20.5 8 12 12.5 3.5 8 12 3.5Z" />
      <path d="M3.5 8v8.2L12 20.5l8.5-4.3V8" />
      <path d="M12 12.5V20.5" />
      <path d="M8 5.7 16.3 9.8" />
    </>
  ),
  sales: (
    <>
      <path d="M7 3.5h10v17l-2.5-1.6L12 20.5 9.5 18.9 7 20.5Z" />
      <path d="M9.5 8h5" />
      <path d="M9.5 11.5h5" />
      <path d="M9.5 15h3" />
    </>
  ),
  shipping: (
    <>
      <path d="M2.5 7h10.5v8.5H2.5Z" />
      <path d="M13 10h4.2l3.3 3.2V15.5H13" />
      <circle cx="6.5" cy="17.6" r="1.6" />
      <circle cx="16.8" cy="17.6" r="1.6" />
    </>
  ),
  balances: (
    <>
      <path d="M12 3.5v15" />
      <path d="M8 20.5h8" />
      <path d="M4 7.5h16" />
      <path d="M4 7.5 1.8 13h4.4L4 7.5Z" />
      <path d="M20 7.5 17.8 13h4.4L20 7.5Z" />
    </>
  ),
  more: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.4 2H4.6L6 16.5Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  empty: (
    <>
      <path d="M4 8h16l-1.5 10.5h-13L4 8Z" />
      <path d="M4 8 6.5 4h11L20 8" />
      <path d="M9 12.5h6" />
    </>
  ),
}

export function SectionIcon({
  name,
  size = 22,
}: {
  name: SectionIconName
  size?: number
}) {
  return (
    <svg
      className="section-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {marks[name]}
    </svg>
  )
}
