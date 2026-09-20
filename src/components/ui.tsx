'use client';

import { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';

// MUI를 대체하는 최소한의 Tailwind 기반 UI 프리미티브.
// 디자인 토큰(네이비/앰버)을 직접 통제하기 위해 외부 컴포넌트 라이브러리 대신
// 이 앱에 필요한 만큼만 직접 구현한다.
// 접근성이 까다로운 다이얼로그류(Modal/BottomSheet)는 Radix UI의 검증된
// 포커스 트랩/스크롤 락/Esc 처리를 그대로 쓰고, 시각 스타일만 Tailwind로 입힌다.

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
  primary: 'bg-accent text-primary shadow-sm hover:brightness-95',
  dark: 'bg-primary text-white shadow-sm hover:bg-primary/80',
  ghost: 'bg-surface-muted text-foreground/70 hover:bg-surface-border',
  'danger-ghost': 'bg-red-50 text-red-600 hover:bg-red-100',
  plain: 'bg-surface text-primary border border-surface-border hover:bg-surface-muted',
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
      className={`inline-flex items-center justify-center rounded-2xl p-2.5 transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${className}`}
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
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{ width: size, height: size }}
      whileTap={{ scale: 0.92 }}
      className={`inline-flex items-center justify-center rounded-2xl shadow-lg transition-colors disabled:opacity-50 ${buttonVariants[variant]} ${className}`}
    >
      {children}
    </motion.button>
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
      <span className="block text-sm font-bold text-foreground/70 mb-1">
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
          className="w-full rounded-2xl border border-surface-border/80 bg-surface px-4 py-3.5 text-[0.95rem] font-medium text-primary disabled:bg-surface-muted disabled:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
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
      className={`w-full rounded-2xl bg-surface-muted/50 px-4 py-4 text-[15px] font-black text-primary shadow-sm border border-surface-border/50 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer  ${className}`}
    >
      {children}
    </select>
  );
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

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
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-[100] bg-black/40"
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={{ duration: 0.15 }}
              />
            </Dialog.Overlay>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
              <Dialog.Content
                asChild
                onOpenAutoFocus={(e) => {
                  const container = e.currentTarget as HTMLElement;
                  const firstInput = container.querySelector<HTMLElement>('input, button, select, textarea');
                  if (firstInput) {
                    e.preventDefault();
                    firstInput.focus();
                  }
                }}
                onPointerDownOutside={(e) => {
                  if (!closeOnBackdrop) e.preventDefault();
                }}
                onInteractOutside={(e) => {
                  if (!closeOnBackdrop) e.preventDefault();
                }}
              >
                <motion.div
                  className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-[32px] bg-surface shadow-2xl shadow-black/20 pointer-events-auto border border-surface-border/40"
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 4 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Dialog.Title className="sr-only">대화 상자</Dialog.Title>
                  <Dialog.Description className="sr-only">CareRoute 다이얼로그</Dialog.Description>
                  {children}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
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
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-[90] bg-black/30"
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              onOpenAutoFocus={(e) => {
                const container = e.currentTarget as HTMLElement;
                const firstInput = container.querySelector<HTMLElement>('input, button, select, textarea');
                if (firstInput) {
                  e.preventDefault();
                  firstInput.focus();
                }
              }}
            >
              <motion.div
                className="fixed inset-x-0 bottom-0 z-[90] rounded-t-[32px] bg-surface shadow-2xl shadow-black/30 border-t border-surface-border/40"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              >
                <Dialog.Title className="sr-only">상세 정보</Dialog.Title>
                <Dialog.Description className="sr-only">CareRoute 상세 시트</Dialog.Description>
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
