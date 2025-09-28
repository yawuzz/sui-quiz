// src/router.tsx
import { createBrowserRouter } from "react-router-dom";
import Home from "./pages/Home";
import HostDashboard from "./pages/HostDashboard";
import Room from "./pages/Room";
import Play from "./pages/Play";

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/host", element: <HostDashboard /> },
  { path: "/room/:roomCode", element: <Room /> },
  { path: "/play/:roomCode", element: <Play /> },
  // çıplak /play açılırsa uyarı veren Play komponentin kendi var
  { path: "/play", element: <Play /> },
  { path: "*", element: <Home /> }
]);
