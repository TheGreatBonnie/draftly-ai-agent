import { Show } from "@clerk/react";
import { Navigate } from "react-router";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <Show when="signed-in" fallback={<Navigate to="/sign-in" replace />}>
      {children}
    </Show>
  );
}
