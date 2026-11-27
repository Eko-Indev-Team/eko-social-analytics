import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/format';
import { Icon } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ai' | 'danger' | 'dark';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'icon';

// Brand reference section 4 (exact class names; theme.css re-themes them for light mode).
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow',
  secondary: 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-slate-800 font-medium',
  ai: 'bg-ai-subtle border border-ai-border text-ai-accent font-semibold hover:bg-purple-900/60',
  danger: 'bg-rose-900/40 hover:bg-rose-900/60 border border-rose-800 text-rose-200 font-semibold',
  dark: 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold',
};

const sizes: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1',
  sm: 'h-8 px-3.5 text-xs gap-1.5',
  md: 'px-6 py-2 text-sm gap-2',
  icon: 'h-8 w-8 justify-center',
};

export function buttonClasses(variant: ButtonVariant = 'secondary', size: ButtonSize = 'sm', className?: string) {
  return cn(
    'inline-flex items-center justify-center rounded transition-colors whitespace-nowrap select-none',
    'disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
    variants[variant],
    sizes[size],
    // "Compact action button": the small primary button uses mono labels and a press scale.
    variant === 'primary' && size !== 'md' && 'font-mono-code active:scale-95',
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'sm', icon, iconRight, loading, className, children, type = 'button', disabled, ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClasses(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Icon name="progress_activity" className="text-[1rem] animate-spin" /> : icon && <Icon name={icon} className="text-[1rem]" />}
      {children}
      {iconRight && <Icon name={iconRight} className="text-[1rem]" />}
    </button>
  );
});

interface LinkButtonProps {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  className?: string;
  children?: ReactNode;
  state?: unknown;
}

export function LinkButton({ to, variant = 'secondary', size = 'sm', icon, iconRight, className, children, state }: LinkButtonProps) {
  return (
    <Link to={to} state={state} className={buttonClasses(variant, size, className)}>
      {icon && <Icon name={icon} className="text-[1rem]" />}
      {children}
      {iconRight && <Icon name={iconRight} className="text-[1rem]" />}
    </Link>
  );
}
