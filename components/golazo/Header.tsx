'use client';

import { useState } from 'react';
import { useWallet } from '@/components/wallet/WalletProvider';
import { shortAddr } from '@/lib/format';
import { fmtDem } from '@/lib/demurrage';
import { CIRCLES_PLAYGROUND, appUrl } from '@/lib/host';

export function Header({ balance }: { balance: bigint | null }) {
  const { address, isConnected, connect, connecting, isMiniappHost, connectError } =
    useWallet();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const showError = connectError && connectError !== dismissed;

  // Inside the Circles host → run the passkey/Safe connect flow.
  // Outside it (e.g. opened directly in a browser) → send the user into the
  // Circles host with Golazo embedded, where connecting actually works.
  function handleClick() {
    if (isMiniappHost) {
      void connect();
    } else {
      window.location.href = `${CIRCLES_PLAYGROUND}?url=${encodeURIComponent(appUrl())}`;
    }
  }

  return (
    <header className="sticky top-0 z-20 backdrop-blur-md bg-[oklch(0.21_0.04_158_/_0.75)] border-b border-border">
      <div className="mx-auto max-w-3xl px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl" aria-hidden>⚽</span>
          <div className="leading-tight">
            <div className="font-bold tracking-tight text-lg">
              Gol<span className="gold-text">azo</span>
            </div>
            <div className="text-[11px] text-muted-foreground -mt-0.5">
              World Cup pools · on Circles
            </div>
          </div>
        </div>

        {isConnected ? (
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold font-mono">
                {balance === null ? '—' : `${fmtDem(balance)} gCRC`}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono">
                {shortAddr(address)}
              </div>
            </div>
            <span className="live-dot h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
        ) : (
          <button
            onClick={handleClick}
            disabled={connecting}
            className="pill bg-primary text-primary-foreground font-semibold text-sm px-4 py-2"
          >
            {connecting ? 'Connecting…' : isMiniappHost ? 'Connect wallet' : 'Open in Circles'}
          </button>
        )}
      </div>

      {showError && (
        <div
          role="alert"
          className="mx-auto max-w-3xl px-4 pb-2 -mt-1"
        >
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-destructive-foreground">
            <span className="flex-1">{connectError}</span>
            <button
              onClick={() => setDismissed(connectError)}
              aria-label="Dismiss"
              className="shrink-0 leading-none opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
