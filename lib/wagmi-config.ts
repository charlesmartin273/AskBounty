import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { arcTestnet } from "./chain/config";
import { arcTransport } from "./chain/rpc-transport";

// Browser wallet config — injected connector only (MetaMask etc.), Arc
// Testnet as the single chain. Uses the same hardened transport as the
// server (retry + Blockscout fallback): the public RPC rate-limits browser
// bursts too.
export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: { [arcTestnet.id]: arcTransport() },
});
