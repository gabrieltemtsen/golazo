'use client';

import { useWallet } from '@/components/wallet/WalletProvider';
import { fmtCrc, shortAddr } from '@/lib/format';

export function Header({ balance }: { balance: bigint | null }) {
  const { address, isConnected, connect, connecting, isMiniappHost } = useWallet();

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
                {balance === null ? '—' : `${fmtCrc(balance)} CRC`}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono">
                {shortAddr(address)}
              </div>
            </div>
            <span className="live-dot h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={connecting}
            className="pill bg-primary text-primary-foreground font-semibold text-sm px-4 py-2"
          >
            {connecting ? 'Connecting…' : isMiniappHost ? 'Connect wallet' : 'Open in Circles'}
          </button>
        )}
      </div>
    </header>
  );
}
