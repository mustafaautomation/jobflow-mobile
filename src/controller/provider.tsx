import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { bootDefault } from '@/controller/boot';
import { errorMessage } from '@/domain/errors';
import { signedOutSnapshot, type AppController, type AppSnapshot } from '@/controller/types';

interface AppContextValue {
  controller: AppController | null;
  snapshot: AppSnapshot;
}

const AppContext = createContext<AppContextValue>({ controller: null, snapshot: signedOutSnapshot });

export function AppProvider({ children, controller }: { children: ReactNode; controller?: AppController }) {
  const [live, setLive] = useState<AppController | null>(controller ?? null);
  const [snapshot, setSnapshot] = useState<AppSnapshot>(controller?.getSnapshot() ?? signedOutSnapshot);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    if (controller) {
      return controller.subscribe(() => setSnapshot(controller.getSnapshot()));
    }
    let cancel = false;
    let unsubscribe = () => {};
    bootDefault()
      .then((next) => {
        if (cancel) return;
        setLive(next);
        setSnapshot(next.getSnapshot());
        unsubscribe = next.subscribe(() => setSnapshot(next.getSnapshot()));
      })
      .catch((error: unknown) => {
        if (!cancel) setBootError(errorMessage(error));
      });
    return () => {
      cancel = true;
      unsubscribe();
    };
  }, [controller]);

  return <AppContext.Provider value={{ controller: live, snapshot: bootError ? { ...snapshot, ready: true, authError: bootError } : snapshot }}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  return useContext(AppContext);
}
