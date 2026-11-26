import { describe, expect, it } from "vitest";
import { scrubEvent, sentryScrubOptions } from "@/lib/sentry-scrub";

describe("scrubEvent", () => {
  it("remove authorization e cookie de request.headers e dos breadcrumbs", () => {
    const event = {
      request: {
        headers: { Authorization: "Bearer nsk_x", cookie: "authjs.session-token=s", accept: "*/*" },
        cookies: { "authjs.session-token": "s" },
      },
      breadcrumbs: [
        { category: "fetch", data: { url: "/api/x", headers: { authorization: "Bearer nsk_y" } } },
        { category: "xhr", data: { request_headers: { Cookie: "c" }, response_headers: { "set-cookie": "c" } } },
        { category: "ui" },
      ],
    };
    const out = scrubEvent(event);
    expect(out.request.headers).toEqual({ accept: "*/*" });
    expect(out.request.cookies).toBeUndefined();
    const json = JSON.stringify(out);
    expect(json).not.toMatch(/nsk_|session-token|authorization|cookie/i);
    expect(out.breadcrumbs[0].data?.url).toBe("/api/x");
  });

  it("beforeBreadcrumb limpa headers no próprio breadcrumb", () => {
    const crumb = { data: { authorization: "Bearer nsk_z", status_code: 200 } };
    expect(sentryScrubOptions.beforeBreadcrumb(crumb).data).toEqual({ status_code: 200 });
  });
});
