import "@testing-library/jest-dom/vitest";

// Provide localStorage mock for Zustand persist middleware (happy-dom doesn't support it without --localstorage-file)
if (typeof globalThis.localStorage === "undefined") {
  const store: Record<string, string> = {};
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
      get length() {
        return Object.keys(store).length;
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
    },
    writable: true,
    configurable: true,
  });
}

const realFetch = globalThis.fetch?.bind(globalThis);

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  if (url.startsWith("/api/")) {
    return Promise.reject(new TypeError(`Unit test API request blocked: ${url}`));
  }

  if (!realFetch) {
    return Promise.reject(new TypeError("fetch is not available in this test environment"));
  }

  return realFetch(input, init);
}) as typeof fetch;
