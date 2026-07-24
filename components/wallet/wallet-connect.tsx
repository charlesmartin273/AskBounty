"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { arcTestnet } from "@/lib/chain/config";
import { toFriendlyError } from "@/lib/ui/friendly-error";

// Injected-wallet connect button + wrong-network guard.
export function WalletConnect() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  if (!isConnected) {
    return (
      <div className="flex flex-col gap-1">
        <Button
          onClick={() => connect({ connector: connectors[0] })}
          disabled={isPending || connectors.length === 0}
        >
          {isPending ? "Connecting…" : "Connect wallet"}
        </Button>
        {connectors.length === 0 && (
          <p className="text-xs text-red-600">No injected wallet found — install MetaMask.</p>
        )}
        {error && <p className="text-xs text-red-600">{toFriendlyError(error).message}</p>}
      </div>
    );
  }

  const wrongChain = chainId !== arcTestnet.id;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-mono">
        {address?.slice(0, 6)}…{address?.slice(-4)}
      </span>
      {wrongChain && (
        <Button
          variant="destructive"
          size="sm"
          disabled={switching}
          onClick={() => switchChain({ chainId: arcTestnet.id })}
        >
          {switching ? "Switching…" : "Switch to Arc Testnet"}
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => disconnect()}>
        Disconnect
      </Button>
    </div>
  );
}
