import { Show, useAuth } from "@clerk/react";
import { Navigate } from "react-router";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <Show when="signed-in" fallback={<Navigate to="/sign-in" replace />}>
      {children}
    </Show>
  );
}
