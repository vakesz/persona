import { useLocale } from '@/i18n/use-locale';
import { LOCALE_LABELS, LOCALES, type Locale } from '@/i18n/locales';
import { cn } from '@/lib/utils';

export interface LocaleSwitcherProps {
  className?: string;
  variant?: 'segmented' | 'minimal';
}

/**
 * Two-button toggle between English and Hungarian. The selected locale is
 * activated immediately and synced to localStorage + Convex via `useLocale`.
 */
export function LocaleSwitcher({ className, variant = 'segmented' }: LocaleSwitcherProps) {
  const { locale, setLocale } = useLocale();

  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-1 text-xs', className)}>
        {LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => {
              setLocale(code);
            }}
            aria-pressed={locale === code}
            className={cn(
              'rounded px-1.5 py-0.5 transition',
              locale === code
                ? 'text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {labelFor(code)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn('border-input inline-flex rounded-md border p-0.5 text-xs', className)}
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => {
            setLocale(code);
          }}
          aria-pressed={locale === code}
          className={cn(
            'rounded-sm px-2.5 py-1 transition',
            locale === code
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
    </div>
  );
}

function labelFor(locale: Locale): string {
  return locale.toUpperCase();
}
