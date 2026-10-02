import { useLayoutEffect, useRef, useState } from 'react'

type ClampedTextProps = {
  children: string
  lines?: number
}

export function ClampedText({ children, lines = 2 }: ClampedTextProps) {
  const textRef = useRef<HTMLSpanElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  useLayoutEffect(() => {
    const node = textRef.current
    if (!node) return

    const measure = () => {
      setOverflowing(node.scrollHeight > node.clientHeight + 1)
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [children, lines])

  return (
    <span
      className={`cell-text-clamp${overflowing ? ' cell-text-clamp--fade' : ''}`}
      style={{ ['--cell-text-lines' as string]: String(lines) }}
    >
      <span ref={textRef} className="cell-text-clamp__text">
        {children}
      </span>
      {overflowing ? (
        <span aria-hidden="true" className="cell-text-clamp__fade" />
      ) : null}
    </span>
  )
}
