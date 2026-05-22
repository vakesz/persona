import { useLingui } from '@lingui/react/macro';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface PageSpinnerProps {
  /**
   * Override the default `min-h-[40vh]` height to match a parent's expected
   * empty-state slot. Pass `'auto'` to drop the min-height entirely (handy
   * inside cards or fixed-height regions).
   */
  minHeight?: '40vh' | '60vh' | 'auto';
  /**
   * Accessible label announced by screen readers. Defaults to "Loading…".
   */
  label?: string;
  className?: string;
}

/**
 * Centered loading indicator used while a query is undefined or a page-level
 * resource is resolving. Replaces the six-times-duplicated
 * `<div className="flex min-h-[…] items-center justify-center"><Loader2 …/>`
 * block scattered across routes.
 */
export function PageSpinner({ minHeight = '40vh', label, className }: PageSpinnerProps) {
  const { t } = useLingui();
  const announce = label ?? t`Loading…`;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center',
        minHeight === '40vh' && 'min-h-[40vh]',
        minHeight === '60vh' && 'min-h-[60vh]',
        className,
      )}
    >
      <Loader2 className="text-muted-foreground size-6 animate-spin" aria-hidden="true" />
      <span className="sr-only">{announce}</span>
    </div>
  );
}
