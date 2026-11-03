import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { App } from "@/app/App";
import { AuthProvider } from "@/features/auth/auth-context";
import { installRuntimeRecovery } from "@/pwa/runtime-recovery";
import "@/styles.css";
import "@/mobile-input-guard.css";



import "@/styles/photo-frame-safety.css";
import "@/components/warm/prototype.css";
import "@/components/warm/warm.css";
import "@/styles/interaction-safety.css";

// A data router provides navigation blocking while retaining existing hash URLs.
const router = createHashRouter([{ path: "*", element: <AuthProvider><App /></AuthProvider> }]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

installRuntimeRecovery();
