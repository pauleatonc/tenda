import { Image } from 'expo-image'

const marks: Record<string, string> = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M6 10.2V20h12V10.2"/><path d="M10 20v-6h4v6"/>',
  inventory:
    '<path d="M12 3.5 20.5 8 12 12.5 3.5 8 12 3.5Z"/><path d="M3.5 8v8.2L12 20.5l8.5-4.3V8"/><path d="M12 12.5V20.5"/><path d="M8 5.7 16.3 9.8"/>',
  sales:
    '<path d="M7 3.5h10v17l-2.5-1.6L12 20.5 9.5 18.9 7 20.5Z"/><path d="M9.5 8h5"/><path d="M9.5 11.5h5"/><path d="M9.5 15h3"/>',
  shipping:
    '<path d="M2.5 7h10.5v8.5H2.5Z"/><path d="M13 10h4.2l3.3 3.2V15.5H13"/><circle cx="6.5" cy="17.6" r="1.6"/><circle cx="16.8" cy="17.6" r="1.6"/>',
  more: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
}

export function SectionIcon({
  name,
  color,
  size = 26,
}: {
  name: string
  color: string
  size?: number
}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${marks[name] ?? ''}</svg>`
  return (
    <Image
      source={{ uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` }}
      style={{ height: size, width: size }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  )
}
