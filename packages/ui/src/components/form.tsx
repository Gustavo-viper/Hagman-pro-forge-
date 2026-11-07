import * as React from 'react';
import { cn } from '../utils.js';

const fieldBase =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-mist placeholder:text-mist/35 transition-colors outline-none focus:border-mystic-400/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-mystic-400/25 disabled:opacity-50 aria-[invalid=true]:border-red-400/70 aria-[invalid=true]:ring-red-400/20';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => <input ref={ref} type={type} className={cn(fieldBase, 'h-11', className)} {...props} />,
);
Input.displayName = 'Input';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(fieldBase, 'h-11 appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10 [&>option]:bg-night', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23b9b3d6' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('text-sm font-medium text-mist/85', className)} {...props} />
));
Label.displayName = 'Label';

export const Checkbox = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn('mt-0.5 size-4 shrink-0 cursor-pointer rounded border-white/20 bg-white/5 accent-arcane-500 focus-visible:ring-2 focus-visible:ring-mystic-400', className)}
      {...props}
    />
  ),
);
Checkbox.displayName = 'Checkbox';

export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-xs text-red-300">
      {children}
    </p>
  );
}
