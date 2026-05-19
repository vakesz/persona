import type { ComponentProps } from 'react';
import { Toaster as Sonner } from 'sonner';

function Toaster(props: ComponentProps<typeof Sonner>) {
  return <Sonner theme="dark" className="toaster group" richColors {...props} />;
}

export { Toaster };
