import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../utils.js';

export const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 outline-none select-none focus-visible:ring-2 focus-visible:ring-mystic-400 focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-arcane-600 via-arcane-500 to-mystic-500 text-white shadow-[0_0_24px_-6px] shadow-arcane-500/70 hover:shadow-[0_0_32px_-4px] hover:shadow-mystic-400/80 hover:brightness-110',
        gold: 'bg-gradient-to-r from-gold-500 to-gold-300 text-void shadow-[0_0_24px_-6px] shadow-gold-400/70 hover:brightness-110',
        glass: 'glass text-mist hover:bg-white/10 hover:border-white/25',
        outline: 'border border-arcane-400/40 bg-transparent text-mist hover:border-arcane-300 hover:bg-arcane-500/10',
        ghost: 'text-mist/80 hover:bg-white/5 hover:text-mist',
        danger: 'bg-red-600/90 text-white hover:bg-red-500',
        link: 'text-mystic-300 underline-offset-4 hover:underline px-0',
      },
      size: {
        sm: 'h-9 px-3.5 text-xs',
        md: 'h-11 px-5',
        lg: 'h-13 px-7 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Spinner className="size-4" />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
