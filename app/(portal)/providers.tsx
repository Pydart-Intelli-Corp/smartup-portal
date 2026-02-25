'use client';

import { ToastProvider, ConfirmProvider } from '@/components/dashboard/shared';

export default function PortalProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
