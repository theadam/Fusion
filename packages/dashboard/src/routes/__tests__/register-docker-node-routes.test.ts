// @vitest-environment node

import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApiRoutes } from "../../routes.js";
import { request } from "../../test-request.js";

const service = {
  listContexts: vi.fn(),
  testConnection: vi.fn(),
};

vi.mock("@fusion/core", async () => {
  const actual = await vi.importActual<typeof import("@fusion/core")>("@fusion/core");
  return { ...actual, DockerClientService: vi.fn().mockImplementation(() => service) };
});

function createStore() {
  return {
    getTask: vi.fn(),
    listTasks: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue({}),
    getSettingsFast: vi.fn().mockResolvedValue({}),
    getSettingsByScope: vi.fn().mockResolvedValue({ global: {}, project: {} }),
    getSettingsByScopeFast: vi.fn().mockResolvedValue({ global: {}, project: {} }),
    getGlobalSettingsStore: vi.fn(() => ({ getSettings: vi.fn().mockResolvedValue({}) })),
    getRootDir: vi.fn().mockReturnValue("/tmp"),
    getFusionDir: vi.fn().mockReturnValue("/tmp/.fusion"),
    listWorkflowSteps: vi.fn().mockResolvedValue([]),
    getMissionStore: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  } as any;
}

function app() {
  const server = express();
  server.use(express.json());
  server.use("/api", createApiRoutes(createStore()));
  return server;
}

describe("registerDockerNodeRoutes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /api/docker/contexts returns contexts", async () => {
    service.listContexts.mockResolvedValue([{ name: "default", isCurrentContext: true }]);
    const res = await request(app(), "GET", "/api/docker/contexts");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ name: "default", isCurrentContext: true }]);
  });

  it("POST /api/docker/test-connection validates host protocol", async () => {
    const res = await request(app(), "POST", "/api/docker/test-connection", JSON.stringify({ hostConfig: { host: "http://bad" } }), { "Content-Type": "application/json" });
    expect(res.status).toBe(400);
  });

  it("POST /api/docker/test-connection passes hostConfig", async () => {
    service.testConnection.mockResolvedValue({ success: true, isLocalDaemon: false });
    const hostConfig = { host: "tcp://1.2.3.4:2376", tlsVerify: true };
    const res = await request(app(), "POST", "/api/docker/test-connection", JSON.stringify({ hostConfig }), { "Content-Type": "application/json" });
    expect(res.status).toBe(200);
    expect(service.testConnection).toHaveBeenCalledWith(hostConfig);
  });

  it("GET /api/docker/local-available maps connection", async () => {
    service.testConnection.mockResolvedValue({ success: true, isLocalDaemon: true, dockerVersion: "24.0" });
    const res = await request(app(), "GET", "/api/docker/local-available");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: true, version: "24.0" });
  });

  it("GET /api/docker/local-available handles errors", async () => {
    service.testConnection.mockRejectedValue(new Error("boom"));
    const res = await request(app(), "GET", "/api/docker/local-available");
    expect(res.status).toBe(200);
    expect((res.body as any).available).toBe(false);
  });
});
