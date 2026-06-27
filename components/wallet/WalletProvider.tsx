'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type RequestCreateAccount = () => Promise<{
  authenticated: boolean;
  address: string;
}>;

type WalletContextValue = {
  address: `0x${string}` | null;
  isConnected: boolean;
  isMiniappHost: boolean;
  connecting: boolean;
  connectError: string | null;
  /** Opens the host passkey/Safe flow. Must be called from a user gesture. */
  connect: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue>({
  address: null,
  isConnected: false,
  isMiniappHost: false,
  connecting: false,
  connectError: null,
  connect: async () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [isMiniappHost, setIsMiniappHost] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const requestRef = useRef<RequestCreateAccount | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    import('@aboutcircles/miniapp-sdk')
      .then((mod) => {
        if (cancelled) return;
        const { onWalletChange, isMiniappMode } = mod;
        setIsMiniappHost(isMiniappMode());
        const rca = (mod as { requestCreateAccount?: RequestCreateAccount })
          .requestCreateAccount;
        requestRef.current = rca ?? null;
        unsubscribe = onWalletChange((addr) =>
          setAddress((addr as `0x${string}` | null) ?? null)
        );
      })
      .catch((err) => console.error('[miniapp-sdk] failed to load:', err));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  async function connect() {
    setConnectError(null);
    const req = requestRef.current;
    if (!req) {
      setConnectError('Open Golazo inside the Circles app to connect your wallet.');
      return;
    }
    setConnecting(true);
    try {
      const { address: addr } = await req();
      if (addr) setAddress(addr.toLowerCase() as `0x${string}`);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Connection cancelled.');
    } finally {
      setConnecting(false);
    }
  }

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        isMiniappHost,
        connecting,
        connectError,
        connect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
