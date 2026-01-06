import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

// =============================================================================
// Button
// =============================================================================

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, leftIcon, rightIcon, disabled, children, ...props }, ref) => {
    const variants: Record<ButtonVariant, string> = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      success: 'btn-success',
      danger: 'btn-danger',
      ghost: 'btn-ghost',
    }

    const sizes: Record<ButtonSize, string> = {
      sm: 'btn-sm',
      md: '',
      lg: 'btn-lg',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'btn inline-flex items-center justify-center gap-2',
          variants[variant],
          sizes[size],
          loading && 'opacity-70 cursor-wait',
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="spinner" />
        ) : leftIcon ? (
          <span className="w-4 h-4">{leftIcon}</span>
        ) : null}
        {children}
        {rightIcon && !loading && <span className="w-4 h-4">{rightIcon}</span>}
      </button>
    )
  }
)
Button.displayName = 'Button'

// =============================================================================
// Input
// =============================================================================

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn('input', error && 'input-error', className)}
          {...props}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        {hint && !error && <p className="text-sm text-surface-500">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

// =============================================================================
// Card
// =============================================================================

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }
  
  return (
    <div className={cn('card', paddings[padding], className)}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center justify-between', className)}>{children}</div>
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('text-lg font-semibold text-surface-100', className)}>{children}</h3>
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-sm text-surface-400 mt-1', className)}>{children}</p>
}

// =============================================================================
// Badge
// =============================================================================

type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'primary'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    neutral: 'badge-neutral',
    primary: 'badge-primary',
  }
  
  return <span className={cn(variants[variant], className)}>{children}</span>
}

// =============================================================================
// Spinner & Loading
// =============================================================================

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return <div className={cn('spinner', sizes[size], className)} />
}

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Spinner size="lg" />
      <p className="text-surface-400">{message}</p>
    </div>
  )
}

// =============================================================================
// Empty State
// =============================================================================

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="w-12 h-12 text-surface-500 mb-4">{icon}</div>}
      <h3 className="text-lg font-medium text-surface-200">{title}</h3>
      {description && <p className="text-surface-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// =============================================================================
// Alert
// =============================================================================

type AlertVariant = 'info' | 'success' | 'warning' | 'danger'

interface AlertProps {
  children: ReactNode
  variant?: AlertVariant
  title?: string
  className?: string
  onDismiss?: () => void
}

export function Alert({ children, variant = 'info', title, className, onDismiss }: AlertProps) {
  const variants: Record<AlertVariant, string> = {
    info: 'bg-accent/10 border-accent/30 text-accent-light',
    success: 'bg-success/10 border-success/30 text-success-light',
    warning: 'bg-warning/10 border-warning/30 text-warning',
    danger: 'bg-danger/10 border-danger/30 text-danger',
  }
  
  return (
    <div className={cn('p-4 rounded-lg border', variants[variant], className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {title && <p className="font-medium mb-1">{title}</p>}
          <div className="text-sm opacity-90">{children}</div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-current opacity-50 hover:opacity-100">×</button>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Stat Card
// =============================================================================

interface StatCardProps {
  label: string
  value: string | number
  subValue?: string
  icon?: ReactNode
}

export function StatCard({ label, value, subValue, icon }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
          {subValue && <p className="text-sm text-surface-500 mt-1">{subValue}</p>}
        </div>
        {icon && <div className="text-surface-500">{icon}</div>}
      </div>
    </div>
  )
}

// =============================================================================
// Tabs
// =============================================================================

interface TabsProps {
  tabs: { id: string; label: string; badge?: number }[]
  activeTab: string
  onChange: (tabId: string) => void
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn('tab', activeTab === tab.id && 'tab-active')}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className="ml-2 bg-accent/20 text-accent text-xs px-1.5 py-0.5 rounded-full">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
