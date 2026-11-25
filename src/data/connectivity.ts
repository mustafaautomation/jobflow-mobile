export interface Connectivity {
  isOnline(): Promise<boolean>;
  subscribe(listener: (online: boolean) => void): () => void;
}

export function alwaysOnline(): Connectivity {
  return {
    async isOnline() {
      return true;
    },
    subscribe() {
      return () => {};
    },
  };
}

export class ConnectivityMonitor implements Connectivity {
  private online = true;
  private listeners = new Set<(online: boolean) => void>();

  constructor() {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && 'onLine' in navigator) {
      this.online = window.navigator.onLine;
      window.addEventListener('online', () => this.setOnline(true));
      window.addEventListener('offline', () => this.setOnline(false));
    }
  }

  setOnline(online: boolean): void {
    if (this.online === online) return;
    this.online = online;
    for (const listener of this.listeners) listener(online);
  }

  async isOnline(): Promise<boolean> {
    return this.online;
  }

  subscribe(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async attachNative(): Promise<() => void> {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator && typeof window !== 'undefined') {
      return () => {};
    }
    try {
      const Network = await import('expo-network');
      const apply = (state: { isConnected?: boolean | null }) => {
        this.setOnline(state.isConnected !== false);
      };
      apply(await Network.getNetworkStateAsync());
      const subscription = Network.addNetworkStateListener(apply);
      return () => subscription.remove();
    } catch {
      return () => {};
    }
  }
}
