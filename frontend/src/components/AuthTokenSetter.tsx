import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { setApiToken } from "../api/client";

export function AuthTokenSetter() {
  const { getToken } = useAuth();

  useEffect(() => {
    getToken().then((token) => setApiToken(token));
  }, [getToken]);

  return null;
}
