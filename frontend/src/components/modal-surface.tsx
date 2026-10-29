import * as Dialog from '@radix-ui/react-dialog';
import { useRef, type ReactNode } from 'react';

/** Modal focus trapping, Escape dismissal and restoration are owned by Radix. */
export function ModalSurface({ children, className, label, onClose }: {
  children: ReactNode; className?: string; label: string; onClose: () => void;
}) {
  const previousFocus=useRef(document.activeElement);
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal><Dialog.Content aria-describedby={undefined} className={className} onCloseAutoFocus={event=>{event.preventDefault();if(previousFocus.current instanceof HTMLElement && previousFocus.current.isConnected)previousFocus.current.focus();}}><Dialog.Title className="sr-only">{label}</Dialog.Title>{children}</Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
