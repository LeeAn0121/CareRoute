'use client';

import { ReactNode, useEffect, useRef } from 'react';

// MUI를 대체하는 최소한의 Tailwind 기반 UI 프리미티브.
// 디자인 토큰(네이비/앰버)을 직접 통제하기 위해 외부 컴포넌트 라이브러리 대신
// 이 앱에 필요한 만큼만 직접 구현한다.

export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-current border-t-transparent animate-spin align-middle ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

type ButtonVariant = 'primary' | 'dark' | 'ghost' | 'danger-ghost' | 'plain';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-[#F5A524] text-[#12203D] shadow-sm hover:brightness-95',
  dark: 'bg-[#12203D] text-white shadow-sm hover:bg-[#1A2F52]',
  ghost: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
  'danger-ghost': 'bg-red-50 text-red-600 hover:bg-red-100',
  plain: 'bg-white text-[#12203D] border border-slate-200 hover:bg-slate-50',
};

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  fullWidth = false,
  disabled = false,
  loading = false,
  className = '',
  startIcon,
}: {
  children: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit';
  variant?: ButtonVariant;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  startIcon?: ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[0.95rem] font-bold transition-transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${buttonVariants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading ? <Spinner size={18} /> : startIcon}
      {children}
    </button>
  );
}

export function IconButton({
  children,
  onClick,
  type = 'button',
  className = '',
  disabled = false,
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit';
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center rounded-lg p-2 transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${className}`}
    >
      {children}
    </button>
  );
}

export function Fab({
  children,
  onClick,
  variant = 'primary',
  size = 56,
  disabled = false,
  className = '',
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: number;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{ width: size, height: size }}
      className={`inline-flex items-center justify-center rounded-2xl shadow-lg transition active:scale-95 disabled:opacity-50 ${buttonVariants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({
  icon,
  children,
  className = '',
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold whitespace-nowrap ${className}`}>
      {icon}
      {children}
    </span>
  );
}

export function TextField({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  required = false,
  disabled = false,
  placeholder,
  endAdornment,
  inputRef,
}: {
  label: string;
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  endAdornment?: ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-bold text-slate-600 mb-1">
        {label}
      </span>
      <div className="relative">
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[0.95rem] font-medium text-[#12203D] disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
        />
        {endAdornment && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">{endAdornment}</div>
        )}
      </div>
    </label>
  );
}

export function NativeSelect({
  value,
  onChange,
  disabled = false,
  children,
  className = '',
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`w-full rounded-lg bg-slate-50 px-2.5 py-2 text-sm font-bold text-[#12203D] shadow-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-400 ${className}`}
    >
      {children}
    </select>
  );
}

// 포커스를 다이얼로그 안에 가두고, Esc로 닫고, 닫힐 때 원래 포커스로 되돌린다.
function useModalA11y(open: boolean, onClose: () => void, containerRef: React.RefObject<HTMLElement | null>) {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !containerRef.current) return;
      const focusables = containerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const firstInput = containerRef.current?.querySelector<HTMLElement>('input, button, select, textarea');
    firstInput?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus?.();
    };
  }, [open, onClose, containerRef]);
}

export function Modal({
  open,
  onClose,
  children,
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  closeOnBackdrop?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y(open, onClose, ref);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y(open, onClose, ref);

  return (
    <div className={`fixed inset-0 z-[90] ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        onMouseDown={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={`absolute inset-x-0 bottom-0 rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {children}
      </div>
    </div>
  );
}
