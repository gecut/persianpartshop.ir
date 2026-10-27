import React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline' | 'default'
  size?: 'sm' | 'md'
  children: React.ReactNode
}

export function Badge({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: 'bg-muted/10 text-foreground',
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-muted/15 text-foreground',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-danger/15 text-danger',
    outline: 'bg-muted/10 text-foreground',
  }

  const sizeStyles = {
    sm: 'text-xs px-2 py-1.5 font-semibold',
    md: 'text-xs font-semibold px-2 py-1.5 ',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
