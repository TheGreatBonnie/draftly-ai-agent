import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider afterSignInUrl="/dashboard" afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </StrictMode>,
);
