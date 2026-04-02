'use client';

import { createContext, useContext, useEffect } from 'react';
import { toast } from 'sonner';
import { AlertType } from '@/hooks/use-alert';

interface AlertContextType {
  showAlert: (options: { type?: AlertType; title: string; description?: string; duration?: number }) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType>({
  showAlert: () => {},
  hideAlert: () => {},
});

export function useAlertContext() {
  return useContext(AlertContext);
}

interface AlertProviderProps {
  children: React.ReactNode;
}

export function AlertProvider({ children }: AlertProviderProps) {
  // 处理URL参数中的alert
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const alertParam = searchParams.get('alert');
      const alertType = searchParams.get('alerttype') as AlertType | null;
      const alertSec = searchParams.get('alertsec');

      if (alertParam) {
        if (alertType === 'destructive') {
          toast.error(alertParam, {
            description: alertSec,
            duration: 2000,
          });
        } else {
          toast.success(alertParam, {
            description: alertSec,
            duration: 2000,
          });
        }
      }
    }
  }, []);

  const showAlert = (options: { type?: AlertType; title: string; description?: string; duration?: number }) => {
    if (options.type === 'destructive') {
      toast.error(options.title, {
        description: options.description,
        duration: options.duration,
      });
    } else {
      toast.success(options.title, {
        description: options.description,
        duration: options.duration,
      });
    }
  };

  const hideAlert = () => {
    toast.dismiss();
  };

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
    </AlertContext.Provider>
  );
}