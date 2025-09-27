import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router"; // sende nasıl ise: "./main-router" vs olabilir
import "./index.css";

import { SuiClientProvider, createNetworkConfig } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@mysten/dapp-kit/dist/index.css"; // dapp-kit default stiller

const { networkConfig } = createNetworkConfig({
  testnet: { url: "https://fullnode.testnet.sui.io" },
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <RouterProvider router={router} />
      </SuiClientProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
