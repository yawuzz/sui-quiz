import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import HostDashboard from "@/pages/HostDashboard";
import Room from "@/pages/Room";
import Play from "@/pages/Play";

function ErrorFallback() {
  return (
    <div style={{ padding: 24 }}>
      <h2>Something went wrong</h2>
      <p>Route not found or component crashed.</p>
      <a href="/">Go Home</a>
    </div>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <HostDashboard />, errorElement: <ErrorFallback /> },
  { path: "/room/:roomCode", element: <Room />, errorElement: <ErrorFallback /> },
  { path: "/play/:roomCode", element: <Play />, errorElement: <ErrorFallback /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
