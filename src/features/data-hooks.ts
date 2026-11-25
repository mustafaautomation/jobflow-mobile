import { useEffect, useRef, useState } from 'react';
import { useAppState } from '@/controller/provider';
import { errorMessage } from '@/domain/errors';
import type { Actor } from '@/domain/types';
import type { Repository } from '@/data/repository';

export type LoadState<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string };

export function useActor(): Actor | null {
  return useAppState().snapshot.actor;
}

export function useRepository(): Repository | null {
  return useAppState().controller?.repository ?? null;
}

export function useSubscribed<T>(loader: () => Promise<T>, key: string): { state: LoadState<T>; retry: () => void } {
  const repo = useRepository();
  const loaderRef = useRef(loader);
  const [attempt, setAttempt] = useState(0);
  const [trackedKey, setTrackedKey] = useState(key);
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });

  if (trackedKey !== key) {
    setTrackedKey(key);
    setState({ status: 'loading' });
  }

  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    if (!repo) return;
    let cancel = false;
    const run = () => {
      loaderRef.current().then(
        (data) => {
          if (!cancel) setState({ status: 'ready', data });
        },
        (error: unknown) => {
          if (!cancel) setState({ status: 'error', message: errorMessage(error) });
        },
      );
    };
    run();
    const unsubscribe = repo.subscribe(run);
    return () => {
      cancel = true;
      unsubscribe();
    };
  }, [repo, key, attempt]);

  return { state, retry: () => setAttempt((value) => value + 1) };
}
