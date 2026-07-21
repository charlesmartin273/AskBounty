import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { arcTestnet } from "./chain/config";

// Browser wallet config — injected connector only (MetaMask etc.), Arc
// Testnet as the single chain. RPC calls from the browser go straight to
// the public RPC (reads are light; writes are user-signed).
export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: { [arcTestnet.id]: http() },
});
