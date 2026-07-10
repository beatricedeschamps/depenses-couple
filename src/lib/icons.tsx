export type IconKey =
  | 'car' | 'cart' | 'home' | 'bolt' | 'shield' | 'dome' | 'star'
  | 'gift' | 'tag' | 'receipt' | 'heart' | 'plane' | 'coffee' | 'music'
  | 'dumbbell' | 'wrench' | 'book' | 'paw' | 'ticket' | 'plus' | 'refund'

const ICON_LIB: Record<string, { o: string; f: string }> = {
  car: {
    o: '<path d="M5 17.5h14M4.5 13l1.7-5.2A2 2 0 0 1 8.1 6.4h7.8a2 2 0 0 1 1.9 1.4L19.5 13M4.5 13h15v3.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1z"/><circle cx="8" cy="17.5" r="1.5"/><circle cx="16" cy="17.5" r="1.5"/>',
    f: '<path d="M4.5 13 6.2 7.8A2 2 0 0 1 8.1 6.4H15.9A2 2 0 0 1 17.8 7.8L19.5 13V16.4A1 1 0 0 1 18.5 17.4H5.5A1 1 0 0 1 4.5 16.4Z"/><circle cx="8" cy="17.7" r="2.2"/><circle cx="16" cy="17.7" r="2.2"/><circle cx="8" cy="17.7" r="0.8" fill="var(--primary-soft)"/><circle cx="16" cy="17.7" r="0.8" fill="var(--primary-soft)"/>',
  },
  cart: {
    o: '<path d="M4 5h2.2l1.7 9.5h8.4L18 8H7"/><circle cx="9" cy="19" r="1.3"/><circle cx="16" cy="19" r="1.3"/>',
    f: '<path d="M3.8 4.5h2.6l.4 2.5H18.5l-1.5 8H7.6L6 5.2H3.8z"/><circle cx="9" cy="19.2" r="1.4"/><circle cx="16" cy="19.2" r="1.4"/>',
  },
  home: {
    o: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10.5V19h12v-8.5"/>',
    f: '<path d="M12 3.3 3.5 11H6v8.5h4V15h4v4.5h4V11h2.5z"/>',
  },
  bolt: {
    o: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    f: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  },
  shield: {
    o: '<path d="M12 3 5 6v5c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V6z"/>',
    f: '<path d="M12 3 5 6v5c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V6z"/>',
  },
  dome: {
    o: '<path d="M4 17h16"/><path d="M5.5 17a6.5 6.5 0 0 1 13 0"/><path d="M12 6.4V4.4"/>',
    f: '<path d="M5 17.2a7 7 0 0 1 14 0z"/><path d="M3.7 17.4h16.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 6.2V4.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  },
  star: {
    o: '<path d="M12 3.5 14.7 9l6 .6-4.4 4.1 1.2 5.9L12 16.7 6.5 19.6l1.2-5.9L3.3 9.6l6-.6z"/>',
    f: '<path d="M12 3.5 14.7 9l6 .6-4.4 4.1 1.2 5.9L12 16.7 6.5 19.6l1.2-5.9L3.3 9.6l6-.6z"/>',
  },
  gift: {
    o: '<path d="M4.5 8h15v3.2h-15z"/><path d="M6 11.2h12V19H6z"/><path d="M12 8v11"/><path d="M12 8S10 3.5 7.8 4.7 9.4 8 12 8zM12 8s2-4.5 4.2-3.3S14.6 8 12 8z"/>',
    f: '<path d="M4.5 8H19.5V11.2H4.5Z"/><path d="M6 11.2H18V19H6Z"/><path d="M12 8C9.8 8 7.6 7 7.6 5.6 7.6 4.2 10.4 4.6 12 8Z"/><path d="M12 8C14.2 8 16.4 7 16.4 5.6 16.4 4.2 13.6 4.6 12 8Z"/><circle cx="12" cy="8" r="1.4"/><path d="M11 8H13V19H11Z" fill="var(--primary-soft)"/>',
  },
  tag: {
    o: '<path d="M4 4.5h6.5l9 9-6.5 6.5-9-9z"/><circle cx="8" cy="8" r="1.3"/>',
    f: '<path d="M4 4.5h6.5l9 9-6.5 6.5-9-9z"/><circle cx="8" cy="8" r="1.2" fill="var(--primary-soft)"/>',
  },
  receipt: {
    o: '<path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.6z"/><path d="M9 8h6M9 12h6"/>',
    f: '<path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.6z"/><path d="M9 8h6M9 12h6" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-linecap="round"/>',
  },
  heart: {
    o: '<path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5c0 5-7 9.5-7 9.5z"/>',
    f: '<path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5c0 5-7 9.5-7 9.5z"/>',
  },
  plane: {
    o: '<path d="M4 13l16-6-6 16-2.6-6.6z"/>',
    f: '<path d="M4 13l16-6-6 16-2.6-6.6z"/>',
  },
  coffee: {
    o: '<path d="M5 8h10v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M15 9h2a2 2 0 0 1 0 4h-2"/><path d="M7 3.4v1.8M10 3.4v1.8"/>',
    f: '<path d="M5 8h10v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M15 9h2a2 2 0 0 1 0 4h-2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 3.4v1.8M10 3.4v1.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  },
  music: {
    o: '<path d="M9 17V6l10-2v11"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
    f: '<path d="M9 17V6l10-2v11"/><circle cx="6.5" cy="17.5" r="2.6"/><circle cx="16.5" cy="15.5" r="2.6"/>',
  },
  dumbbell: {
    o: '<path d="M6.5 8v8M3.5 9.5v5M17.5 8v8M20.5 9.5v5M6.5 12h11"/>',
    f: '<path d="M6.5 8v8M3.5 9.5v5M17.5 8v8M20.5 9.5v5M6.5 12h11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  },
  wrench: {
    o: '<path d="M15 6.5a3.5 3.5 0 0 0-4.6 4.6l-6 6 2.9 2.9 6-6A3.5 3.5 0 0 0 18 9.5l-2 2-1.9-1.9z"/>',
    f: '<path d="M15 6.5a3.5 3.5 0 0 0-4.6 4.6l-6 6 2.9 2.9 6-6A3.5 3.5 0 0 0 18 9.5l-2 2-1.9-1.9z"/>',
  },
  book: {
    o: '<path d="M5 4h11a2 2 0 0 1 2 2v13H6a2 2 0 0 1-2-2z"/><path d="M18 17H6a2 2 0 0 0-2 2"/>',
    f: '<path d="M5 4h11a2 2 0 0 1 2 2v12H6a2 2 0 0 0-2 2V6a2 2 0 0 1 2-2z"/>',
  },
  paw: {
    o: '<circle cx="7" cy="9" r="1.6"/><circle cx="12" cy="7.2" r="1.6"/><circle cx="17" cy="9" r="1.6"/><path d="M12 12c-2.4 0-4.3 1.9-4.3 3.9S9.3 20.5 12 20.5s4.3-1.6 4.3-3.6S14.4 12 12 12z"/>',
    f: '<circle cx="7" cy="9" r="1.7"/><circle cx="12" cy="7.2" r="1.7"/><circle cx="17" cy="9" r="1.7"/><path d="M12 12c-2.4 0-4.3 1.9-4.3 3.9S9.3 20.5 12 20.5s4.3-1.6 4.3-3.6S14.4 12 12 12z"/>',
  },
  ticket: {
    o: '<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4z"/><path d="M13 6.5v11"/>',
    f: '<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4z"/><path d="M13 6.5v11" fill="none" stroke="var(--primary-soft)" stroke-width="1.6" stroke-dasharray="2 2"/>',
  },
  plus: {
    o: '<path d="M12 5v14M5 12h14"/>',
    f: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8" fill="none" stroke="var(--primary-soft)" stroke-width="2"/>',
  },
  refund: {
    o: '<path d="M10 7L5 11l5 4"/><path d="M5 11h9a5 5 0 0 1 0 10h-2"/>',
    f: '<path d="M10 7L5 11l5 4"/><path d="M5 11h9a5 5 0 0 1 0 10h-2"/>',
  },
}

interface IconProps {
  id: string
  filled?: boolean
  size?: number
  className?: string
  style?: React.CSSProperties
}

export function Icon({ id, filled = false, size = 24, className, style }: IconProps) {
  const icon = ICON_LIB[id] ?? ICON_LIB.tag
  const inner = filled ? icon.f : icon.o
  const strokeAttrs = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'
  const fillAttrs = 'fill="currentColor" stroke="none"'
  const attrs = filled ? fillAttrs : strokeAttrs
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', width: size, height: size, flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{
        __html: `<svg viewBox="0 0 24 24" width="100%" height="100%" ${attrs}>${inner}</svg>`,
      }}
    />
  )
}

export const ALL_ICONS: IconKey[] = [
  'car', 'cart', 'home', 'bolt', 'shield', 'dome', 'star',
  'gift', 'tag', 'receipt', 'heart', 'plane', 'coffee', 'music',
  'dumbbell', 'wrench', 'book', 'paw', 'ticket',
]
