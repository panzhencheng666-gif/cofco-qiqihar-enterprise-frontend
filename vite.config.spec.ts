import { describe, expect, it, vi } from "vitest";

import { localDevelopmentActor, localApiProxy } from "./vite.config";

describe("local overview API development proxy", () => {
  it("forces the loopback development actor after removing browser input", () => {
    let proxyRequestHandler:
      | ((request: {
          removeHeader(name: string): void;
          setHeader(name: string, value: string): void;
        }) => void)
      | undefined;
    const proxy = {
      on: vi.fn((event: string, handler: typeof proxyRequestHandler) => {
        if (event === "proxyReq") proxyRequestHandler = handler;
      }),
    };

    expect(localApiProxy.configure).toBeTypeOf("function");
    localApiProxy.configure?.(proxy as never, {});
    const request = { removeHeader: vi.fn(), setHeader: vi.fn() };
    proxyRequestHandler?.(request);

    expect(localApiProxy.target).toBe("http://127.0.0.1:8090");
    expect(request.removeHeader).toHaveBeenCalledWith("x-actor");
    expect(request.setHeader).toHaveBeenCalledWith("X-Actor", localDevelopmentActor);
  });
});
