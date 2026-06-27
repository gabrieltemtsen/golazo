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
  // Mirror of `address` so connect() always sees the latest value without
  // being recreated, avoiding a re-trigger of the host create/login flow.
  const addressRef = useRef<`0x${string}` | null>(null);

  function applyAddress(addr: string | null) {
    const next = (addr ? (addr.toLowerCase() as `0x${string}`) : null);
    addressRef.current = next;
    setAddress(next);
  }

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
        // Existing accounts auto-connect here — no popup needed.
        unsubscribe = onWalletChange((addr) => applyAddress(addr ?? null));
      })
      .catch((err) => console.error('[miniapp-sdk] failed to load:', err));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  async function connect() {
    setConnectError(null);
    // Already connected (e.g. auto-connected via onWalletChange) — don't
    // re-open the host's "create account / log in" popup.
    if (addressRef.current) return;
    const req = requestRef.current;
    if (!req) {
      setConnectError('Open Golazo inside the Circles app to connect your wallet.');
      return;
    }
    setConnecting(true);
    try {
      const { address: addr } = await req();
      if (addr) applyAddress(addr);
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
