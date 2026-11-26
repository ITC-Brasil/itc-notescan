import { beforeEach, describe, expect, it, vi } from "vitest";

// Matriz de acesso m8-01: rotas de leitura (3a) e rotas fora do alcance de agentes.
const { db, auth } = vi.hoisted(() => {
  const list = () => ({ findMany: vi.fn().mockResolvedValue([]) });
  return {
    db: {
      apiToken: { findUnique: vi.fn(), update: vi.fn() },
      notebook: list(),
      project: list(),
      uM: list(),
      lifecycleEvent: list(),
      conference: list(),
    },
    auth: vi.fn(),
  };
});
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth }));

import { GET as notebooks } from "@/app/api/notebooks/route";
import { GET as history } from "@/app/api/notebooks/[id]/history/route";
import { GET as projects } from "@/app/api/projects/route";
import { GET as ums } from "@/app/api/ums/route";
import { GET as conferencesGet, POST as conferencesPost } from "@/app/api/conferences/route";
import { GET as dashboard } from "@/app/api/conferences/dashboard/route";
import { POST as notifySend } from "@/app/api/notifications/send/route";
import { POST as notifyDispatch } from "@/app/api/notifications/dispatch/route";
import {
  DELETE as unsubscribe,
  POST as subscribe,
} from "@/app/api/notifications/subscribe/route";
import { ALL_SCOPES, invalidTokens, tokenRecord, withBearer } from "./helpers/actor";

const params = { params: Promise.resolve({ id: "n1" }) };
const URL_ = "http://x/api/x";
const plain = () => new Request(URL_);

const reads = [
  ["GET /api/notebooks", (r: Request) => notebooks(r)],
  ["GET /api/notebooks/[id]/history", (r: Request) => history(r, params)],
  ["GET /api/projects", (r: Request) => projects(r)],
  ["GET /api/ums", (r: Request) => ums(r)],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue(null);
  db.apiToken.findUnique.mockResolvedValue(null);
});

describe.each(reads)("%s (3a: read:catalog)", (_, call) => {
  it("token com read:catalog → 200, sem consultar a sessão", async () => {
    db.apiToken.findUnique.mockResolvedValue(tokenRecord(["read:catalog"]));
    expect((await call(withBearer(URL_))).status).toBe(200);
    expect(auth).not.toHaveBeenCalled();
  });

  it("token sem read:catalog → 403", async () => {
    db.apiToken.findUnique.mockResolvedValue(
      tokenRecord(["write:catalog", "delete:catalog", "destructive"]),
    );
    expect((await call(withBearer(URL_))).status).toBe(403);
  });

  it.each(Object.entries(invalidTokens))("token %s → 401", async (_k, rec) => {
    db.apiToken.findUnique.mockResolvedValue(rec === null ? null : rec());
    auth.mockResolvedValue({ user: { id: "m1", role: "MASTER" } }); // nunca cai no cookie
    expect((await call(withBearer(URL_))).status).toBe(401);
  });

  it("sessão humana inalterada: USER lê (200); sem sessão → 401", async () => {
    auth.mockResolvedValue({ user: { id: "u1", role: "USER" } });
    expect((await call(plain())).status).toBe(200);
    auth.mockResolvedValue(null);
    expect((await call(plain())).status).toBe(401);
  });
});

describe("fora do alcance de agentes → 403 com todos os escopos", () => {
  const post = () => withBearer(URL_, { method: "POST", body: "{}" });
  it.each([
    ["GET /api/conferences", () => conferencesGet(withBearer(URL_))],
    ["POST /api/conferences", () => conferencesPost(post())],
    ["GET /api/conferences/dashboard", () => dashboard(withBearer(URL_))],
    ["POST /api/notifications/send", () => notifySend(post())],
    ["POST /api/notifications/dispatch", () => notifyDispatch(post())],
    ["POST /api/notifications/subscribe", () => subscribe(post())],
    ["DELETE /api/notifications/subscribe", () => unsubscribe(withBearer(URL_, { method: "DELETE" }))],
  ])("%s", async (_, call) => {
    db.apiToken.findUnique.mockResolvedValue(tokenRecord(ALL_SCOPES));
    expect((await call()).status).toBe(403);
    expect(auth).not.toHaveBeenCalled();
  });
});
