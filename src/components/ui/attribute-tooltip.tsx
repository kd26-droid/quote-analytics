import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface AttributeTooltipProps {
  attributes: Array<{ spec_name: string; spec_value: string }> | undefined;
  children: React.ReactNode;
}

/**
 * Wraps any element and shows item attributes/specs on hover.
 * Uses a portal + fixed positioning so it's never clipped by overflow containers.
 */
export function AttributeTooltip({ attributes, children }: AttributeTooltipProps) {
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const specs = attributes || [];

  const handleEnter = useCallback(() => {
    console.log('[AttributeTooltip] HOVER — attributes:', JSON.stringify(attributes), 'specs.length:', specs.length);
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const above = window.innerHeight - rect.bottom < 200;
    setPos({
      x: rect.left,
      y: above ? rect.top : rect.bottom,
      above,
    });
  }, [attributes, specs.length]);

  if (specs.length === 0) {
    console.log('[AttributeTooltip] SKIPPED — empty attributes:', JSON.stringify(attributes));
    return <>{children}</>;
  }

  return (
    <div
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && createPortal(
        <div
          className="fixed z-[9999] bg-white border border-gray-300 rounded-lg shadow-xl p-2.5 min-w-[200px] max-w-[320px] pointer-events-none"
          style={{
            left: pos.x,
            ...(pos.above
              ? { bottom: window.innerHeight - pos.y + 4 }
              : { top: pos.y + 4 }
            ),
          }}
        >
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Specifications</div>
          <div className="space-y-1">
            {specs.map((attr, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-gray-500 font-medium whitespace-nowrap">{attr.spec_name}:</span>
                <span className="text-gray-900">{attr.spec_value}</span>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
