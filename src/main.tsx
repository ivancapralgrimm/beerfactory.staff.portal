import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { App } from "@/app/App";
import { AuthProvider } from "@/features/auth/auth-context";
import { installHostFailover } from "@/lib/host-failover";
import "@/styles.css";
import "@/mobile-input-guard.css";
import "@/components/craft/craft.css";
import "@/workspace.css";

// The test hook is inert for normal URLs. Real automatic failover remains disabled.
installHostFailover();

// A data router provides navigation blocking while retaining existing hash URLs.
const router = createHashRouter([{ path: "*", element: <AuthProvider><App /></AuthProvider> }]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
