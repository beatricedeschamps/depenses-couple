import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  label?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--fg)]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-11 w-full rounded-xl border px-3 text-sm bg-[var(--input-bg)] text-[var(--fg)] outline-none transition-all',
            'placeholder:text-[var(--muted-fg)]',
            'focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]',
            error
              ? 'border-[var(--danger)] focus:ring-[var(--danger)]'
              : 'border-[var(--border)]',
            className
          )}
          {...props}
        />
        {hint && (
          <p className={cn('text-xs', error ? 'text-[var(--danger)]' : 'text-[var(--muted-fg)]')}>
            {hint}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
