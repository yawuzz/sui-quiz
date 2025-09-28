// src/AppLayout.tsx
import { Outlet, Link, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createNetworkConfig, SuiClientProvider, WalletProvider, ConnectButton } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";

import "@mysten/dapp-kit/dist/index.css";

const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl("testnet") },
  mainnet: { url: getFullnodeUrl("mainnet") },
  // devnet: { url: getFullnodeUrl("devnet") },
});

const queryClient = new QueryClient();

export default function AppLayout() {
  const loc = useLocation();

  return (
    <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
      <WalletProvider autoConnect>
        <QueryClientProvider client={queryClient}>
          {/* Basit bir üst bar; Connect düğmesi her sayfada mevcut */}
          <div className="w-full border-b border-border bg-card/50">
            <div className="max-w-6xl mx-auto p-3 flex items-center justify-between">
              <Link to="/" className="font-semibold">Sui Quiz</Link>
              <div className="flex items-center gap-3">
                <Link to="/" className={`text-sm ${loc.pathname === "/" ? "text-primary" : ""}`}>Home</Link>
                <Link to="/host" className={`text-sm ${loc.pathname.startsWith("/host") ? "text-primary" : ""}`}>Host</Link>
                <ConnectButton />
              </div>
            </div>
          </div>

          {/* Sayfa içerikleri */}
          <Outlet />
        </QueryClientProvider>
      </WalletProvider>
    </SuiClientProvider>
  );
}
