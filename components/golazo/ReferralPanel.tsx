'use client';

import { useState } from 'react';
import { Users, Gift, Copy, Check } from 'lucide-react';
import { useWallet } from '@/components/wallet/WalletProvider';
import type { ReferralStats } from '@/lib/golazo';
import { inviteLink } from '@/lib/host';
import { fmtCrc } from '@/lib/format';

export function ReferralPanel({
  stats,
  busy,
  onClaim,
}: {
  stats: ReferralStats;
  busy: boolean;
  onClaim: () => void;
}) {
  const { address, isConnected } = useWallet();
  const [copied, setCopied] = useState(false);

  const link = address ? inviteLink(address) : '';

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — link is still shown */
    }
  }

  async function share() {
    if (!link) return;
    const text = `I'm calling the World Cup knockouts on Golazo ⚽ — back a result with Circles, split the pot if you're right. Join with my link:`;
    if (typeof navigator !== 'undefined' && (navigator as Navigator).share) {
      try {
        await (navigator as Navigator).share({ title: 'Golazo', text, url: link });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    copy();
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Gift size={16} className="text-gold" />
        <h2 className="font-bold">Invite friends, earn on-chain</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        When your invite lands a <strong>brand-new Circles wallet</strong> that places its first
        stake, you instantly earn a{' '}
        <span className="text-gold font-semibold font-mono">{fmtCrc(stats.bounty)} CRC</span> bounty —
        paid by the contract, no claim form. You also keep a slice of the rake every time a friend
        you brought in wins.
      </p>

      {isConnected ? (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Stat icon={<Users size={14} />} label="Wallets landed" value={stats.count.toString()} />
            <Stat icon={<Gift size={14} />} label="Earned" value={`${fmtCrc(stats.credits)} CRC`} gold />
          </div>

          <div className="flex gap-2 mb-2">
            <button
              onClick={share}
              className="flex-1 pill bg-primary text-primary-foreground font-bold py-2.5 text-sm"
            >
              Share invite link
            </button>
            <button
              onClick={copy}
              className="pill bg-muted px-3 py-2.5 text-sm flex items-center gap-1.5"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {link && (
            <div className="font-mono text-[10px] text-muted-foreground truncate bg-muted/50 rounded px-2 py-1 mb-2">
              {link}
            </div>
          )}

          {stats.credits > 0n && (
            <button
              disabled={busy}
              onClick={onClaim}
              className="w-full pill font-bold py-2.5 text-primary-foreground"
              style={{ background: 'var(--gold)' }}
            >
              {busy ? 'Claiming…' : `Withdraw ${fmtCrc(stats.credits)} CRC`}
            </button>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Connect your wallet to get your invite link.</p>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  gold,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  gold?: boolean;
}) {
  return (
    <div className="rounded-md bg-muted/60 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-0.5">
        {icon}
        {label}
      </div>
      <div className={`font-mono font-bold ${gold ? 'gold-text' : ''}`}>{value}</div>
    </div>
  );
}
