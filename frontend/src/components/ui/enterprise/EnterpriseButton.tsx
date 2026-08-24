import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './utils';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type CommonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
};

type EnterpriseButtonProps =
  | (CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: never })
  | (CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string });

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'enterprise-button-primary',
  secondary: 'enterprise-button-secondary',
  danger: 'enterprise-button-danger',
  ghost: 'inline-flex min-h-9 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-bold text-[var(--tcdx-color-text-primary)] transition hover:bg-[var(--tcdx-color-surface-muted)] focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)]',
};

export default function EnterpriseButton(props: EnterpriseButtonProps) {
  const { children, variant = 'primary', className } = props;
  const classes = cx(variantClasses[variant], className);

  if ('href' in props && props.href) {
    const {
      href,
      children: omittedChildren,
      variant: omittedVariant,
      className: omittedClassName,
      ...anchorProps
    } = props;
    void omittedChildren;
    void omittedVariant;
    void omittedClassName;

    return (
      <a {...anchorProps} href={href} className={classes}>
        {children}
      </a>
    );
  }

  const {
    children: omittedChildren,
    variant: omittedVariant,
    className: omittedClassName,
    ...buttonProps
  } = props as CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;
  void omittedChildren;
  void omittedVariant;
  void omittedClassName;

  return (
    <button {...buttonProps} className={classes}>
      {children}
    </button>
  );
}
