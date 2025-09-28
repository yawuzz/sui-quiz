import { createBrowserRouter } from "react-router-dom";

import Home from "./pages/Home";             // Dosya adı Home.tsx ise import da Home olmalı
import HostDashboard from "./pages/HostDashboard";
import Room from "./pages/Room";
import Play from "./pages/Play";

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/host", element: <HostDashboard /> },
  { path: "/room/:roomCode", element: <Room /> },
  { path: "/play/:roomCode?", element: <Play /> },
]);
