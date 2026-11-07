import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../utils.js';

export const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide', {
  variants: {
    variant: {
      default: 'bg-white/10 text-mist',
      arcane: 'bg-arcane-500/20 text-arcane-200 ring-1 ring-arcane-400/30',
      mystic: 'bg-mystic-500/15 text-mystic-200 ring-1 ring-mystic-400/30',
      gold: 'bg-gold-400/15 text-gold-200 ring-1 ring-gold-300/40',
      success: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30',
      danger: 'bg-red-500/15 text-red-200 ring-1 ring-red-400/30',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-xl bg-white/[0.06]', className)} {...props} />;
}

export function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-white/10', className)}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-arcane-500 via-mystic-400 to-gold-300 transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const alertVariants = cva('flex gap-3 rounded-xl border p-4 text-sm', {
  variants: {
    variant: {
      info: 'border-mystic-400/30 bg-mystic-500/10 text-mystic-100',
      success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
      warning: 'border-gold-300/30 bg-gold-400/10 text-gold-100',
      danger: 'border-red-400/30 bg-red-500/10 text-red-100',
    },
  },
  defaultVariants: { variant: 'info' },
});

export function Alert({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role={variant === 'danger' ? 'alert' : 'status'} className={cn(alertVariants({ variant }), className)} {...props} />;
}
