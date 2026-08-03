import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { arcTestnet } from "./chain/config";
import { arcTransport } from "./chain/rpc-transport";

// Browser wallet config - injected connector only (MetaMask etc.), Arc
// Testnet as the single chain. Uses the same hardened transport as the
// server (retry + Blockscout fallback): the public RPC rate-limits browser
// bursts too.
export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: { [arcTestnet.id]: arcTransport() },
  // Every app route is server-rendered, so wagmi must NOT report a
  // restored-from-storage connection on the first client render: the server
  // emits the disconnected nav, the client emitted the connected one, and
  // React threw away the whole nav subtree on each load (hydration #418).
  // With ssr, wagmi hydrates disconnected and reconnects after mount.
  ssr: true,
});
