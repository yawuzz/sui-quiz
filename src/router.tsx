// src/router.tsx
import { createBrowserRouter } from "react-router-dom";
import HostDashboard from "./pages/HostDashboard";
import Room from "./pages/Room";
import Play from "./pages/Play";

const router = createBrowserRouter([
  { path: "/", element: <HostDashboard /> },
  { path: "/room/:roomCode", element: <Room /> },
  { path: "/play/:roomCode?", element: <Play /> },
]);

export default router;
