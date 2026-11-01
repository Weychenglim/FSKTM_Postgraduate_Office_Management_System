import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { THIN_SCROLLBAR } from '../utils/scrollbar';

const GAP = 8;
const MARGIN = 8;

interface FloatingMenuProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style'> {
  anchor: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  width?: number;
  maxHeight?: number;
  align?: 'left' | 'right';
}

/**
 * A pop-up held under its button the way SelectMenu holds its list: drawn
 * over the page, so it never stretches the page or adds a second scrollbar,
 * and opened upwards when there is more room above.
 */
export const FloatingMenu: React.FC<FloatingMenuProps> = ({ anchor, onClose, width, maxHeight = 416, align = 'left', className = '', children, ...rest }) => {
  const panel = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
  const close = useRef(onClose);
  close.current = onClose;

  const place = useCallback(() => {
    const box = anchor.current?.getBoundingClientRect();
    if (!box || !panel.current) return;
    const room = window.innerWidth - MARGIN * 2;
    const wide = Math.min(width ?? box.width, room);
    const left = Math.max(MARGIN, Math.min(align === 'right' ? box.right - wide : box.left, window.innerWidth - MARGIN - wide));
    const below = window.innerHeight - box.bottom - GAP - MARGIN;
    const above = box.top - GAP - MARGIN;
    const needed = Math.min(panel.current.scrollHeight, maxHeight);
    const up = below < needed && above > below;
    const next: React.CSSProperties = {
      left,
      width: wide,
      maxHeight: Math.max(0, Math.min(maxHeight, up ? above : below)),
      ...(up ? { bottom: window.innerHeight - box.top + GAP } : { top: box.bottom + GAP }),
    };
    setStyle(current => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
  }, [anchor, width, maxHeight, align]);

  useLayoutEffect(place);

  useEffect(() => {
    const update = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      place();
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchor.current?.contains(target) && !panel.current?.contains(target)) close.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const stay = anchor.current?.contains(document.activeElement);
      close.current();
      if (!stay) anchor.current?.querySelector<HTMLElement>('[aria-expanded]')?.focus({ preventScroll: true });
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [anchor, place]);

  return createPortal(
    <div ref={panel} {...rest} style={style} className={`fixed z-[10020] overflow-y-auto overscroll-contain font-sans text-left ${THIN_SCROLLBAR} ${className}`}>
      {children}
    </div>,
    document.body,
  );
};
