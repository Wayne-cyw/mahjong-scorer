import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'selection:bg-primary selection:text-primary-foreground file:text-foreground placeholder:text-muted-foreground border-felt-deep bg-felt-deep text-foreground h-9 w-full min-w-0 rounded-md border-b-4 px-3 py-1 text-base transition-[background-color,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-sign focus-visible:bg-felt',
        'aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
