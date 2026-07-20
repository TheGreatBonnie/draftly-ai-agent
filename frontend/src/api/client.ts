const BASE_URL = "/api";

let _token: string | null = null;
let _pendingToken: Promise<string | null> | null = null;

export function setApiToken(token: string | null) {
  _token = token;
  _pendingToken = token !== null ? Promise.resolve(token) : null;
}

export function setPendingToken(promise: Promise<string | null>) {
  _pendingToken = promise;
  promise.then((token) => {
    _token = token;
    _pendingToken = null;
  });
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (_pendingToken) {
    await _pendingToken;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (_token) {
    headers["Authorization"] = `Bearer ${_token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { ...headers, ...options?.headers as Record<string, string> },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail ?? body.error ?? "Request failed");
  }
  return res.json();
}

export { request, ApiError };
