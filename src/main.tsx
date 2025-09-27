import React from "react";
import ReactDOM from "react-dom/client";

// (node polyfills — buffer vs. için)
import "./polyfills";

// Tailwind / global css
import "./index.css";

// Router
import { RouterProvider } from "react-router-dom";
import { router } from "./router";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
