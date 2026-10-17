'use client';

import { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';

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
  primary: 'bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(var(--primary),0.25)] hover:opacity-95 border border-black/10 dark:border-white/20',
  dark: 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md hover:opacity-90',
  ghost: 'bg-surface-muted/80 text-foreground/80 hover:bg-surface-border/60 border border-surface-border/40',
  'danger-ghost': 'bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20',
  plain: 'bg-surface text-foreground border border-surface-border hover:bg-surface-muted shadow-sm',
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
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
      className={`inline-flex items-center justify-center gap-2 rounded-[20px] px-4 py-3 text-[15px] font-black transition-all disabled:opacity-40 disabled:pointer-events-none ${buttonVariants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading ? <Spinner size={18} /> : startIcon}
      {children}
    </motion.button>
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
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
      className={`inline-flex items-center justify-center rounded-[20px] p-2.5 transition-colors disabled:opacity-40 disabled:pointer-events-none ${className}`}
    >
      {children}
    </motion.button>
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
      whileTap={{ scale: 0.90 }}
      transition={{ type: 'spring', damping: 22, stiffness: 350 }}
      className={`inline-flex items-center justify-center rounded-[24px] shadow-2xl transition-all disabled:opacity-50 ${buttonVariants[variant]} ${className}`}
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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black tracking-tight whitespace-nowrap shadow-xs border border-white/10 ${className}`}>
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
      <span className="block text-[13px] font-bold text-foreground/70 mb-1.5 pl-1">
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
          className="w-full rounded-[20px] border border-surface-border/60 bg-surface/90 px-4 py-3.5 text-[15px] font-bold text-foreground placeholder:text-foreground/35 disabled:bg-surface-muted disabled:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent transition-all shadow-xs"
        />
        {endAdornment && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">{endAdornment}</div>
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
      className={`w-full rounded-[20px] bg-surface/90 px-4 py-3.5 text-[15px] font-black text-foreground shadow-xs border border-surface-border/60 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all cursor-pointer ${className}`}
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
                className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-md"
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <div className="modal-portal-layer fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
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
                  className="modal-scroll-area w-full max-w-md max-h-[92dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain scroll-pb-28 scroll-pt-20 rounded-t-[36px] sm:rounded-[36px] bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.3)] pointer-events-auto border border-white/20 dark:border-white/10"
                  initial={{ opacity: 0, scale: 0.95, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 16 }}
                  transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                >
                  {/* One UI Pull Handle Indicator for Mobile */}
                  <div className="no-print pt-3 pb-1 flex justify-center sm:hidden">
                    <div className="w-10 h-1.5 rounded-full bg-foreground/20" />
                  </div>
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
                className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-md"
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
                className="fixed inset-x-0 bottom-0 z-[90] rounded-t-[36px] bg-surface shadow-[0_-12px_40px_rgba(0,0,0,0.25)] border-t border-white/20 dark:border-white/10 max-h-[85vh] overflow-y-auto"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              >
                <div className="pt-3 pb-1 flex justify-center">
                  <div className="w-12 h-1.5 rounded-full bg-foreground/20" />
                </div>
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
