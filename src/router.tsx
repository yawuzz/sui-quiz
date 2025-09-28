// src/router.tsx
import { createBrowserRouter } from "react-router-dom";
import AppLayout from "./AppLayout";

// Sayfalar (dosya adları birebir küçük harflerle aynı olmalı)
import Home from "./pages/Home";
import HostDashboard from "./pages/HostDashboard";
import Room from "./pages/Room";
import Play from "./pages/Play";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,           // <-- TÜM ROUTE’LAR PROVIDER’LARIN İÇİNDE
    children: [
      { path: "/", element: <Home /> },
      { path: "/host", element: <HostDashboard /> },
      { path: "/room/:roomCode", element: <Room /> },
      { path: "/play/:roomCode", element: <Play /> },
    ],
  },
]);
