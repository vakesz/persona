import { type ReactNode, type SyntheticEvent, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  ariaLabel: string;
  className?: string;
}

/**
 * Minimal modal dialog built on the native `<dialog>` element so we get
 * focus management, escape-to-close, and accessibility for free without
 * pulling in Radix Dialog.
 */
export function Dialog({ open, onOpenChange, children, ariaLabel, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  const handleBackdropClick = (event: SyntheticEvent<HTMLDialogElement, MouseEvent>) => {
    if (event.target === ref.current) {
      onOpenChange(false);
    }
  };

  return (
    <dialog
      ref={ref}
      aria-label={ariaLabel}
      onClose={() => {
        onOpenChange(false);
      }}
      onClick={handleBackdropClick}
      className={cn(
        'bg-card text-card-foreground w-[min(28rem,calc(100vw-2rem))] rounded-xl border p-0 shadow-lg',
        'backdrop:bg-black/50 backdrop:backdrop-blur-sm',
        'open:animate-in open:fade-in-0',
        className,
      )}
    >
      {children}
    </dialog>
  );
}

export function DialogHeader({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1 px-6 pt-6">{children}</div>;
}

export function DialogTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-lg leading-tight font-semibold tracking-tight">{children}</h2>;
}

export function DialogDescription({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}

export function DialogBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4 px-6 py-4">{children}</div>;
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-2 border-t px-6 py-4">{children}</div>;
}
