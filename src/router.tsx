// src/router.tsx
import { createBrowserRouter } from "react-router-dom";

import Home from "src/pages/Home";
import HostDashboard from "./pages/HostDashboard";
import Room from "./pages/Room";
import Play from "./pages/Play";

function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center p-8">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-bold">404 • Not Found</h1>
        <p className="text-sm text-gray-500">
          This page does not exist. Go back to the home page.
        </p>
        <a
          href="/"
          className="inline-block px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
        >
          Home
        </a>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/host", element: <HostDashboard /> },
  { path: "/room/:roomCode", element: <Room /> },
  { path: "/play/:roomCode", element: <Play /> },
  { path: "/play", element: <Play /> },
  { path: "*", element: <NotFound /> },
]);
