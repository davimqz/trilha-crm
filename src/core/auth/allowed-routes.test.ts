import { describe, expect, it } from "vitest";

import { isAllowedAuthRequest } from "./allowed-routes";

const request = (method: string, path: string) => new Request(`http://localhost:3000${path}`, { method });

describe("isAllowedAuthRequest", () => {
  it.each([
    ["GET", "/api/auth/get-session"],
    ["POST", "/api/auth/sign-in/email"],
    ["POST", "/api/auth/sign-out"],
    ["POST", "/api/auth/change-password"],
  ])("permite %s %s", (method, path) => {
    expect(isAllowedAuthRequest(request(method, path))).toBe(true);
  });

  it.each([
    ["POST", "/api/auth/sign-up/email"],
    ["POST", "/api/auth/update-user"],
    ["POST", "/api/auth/request-password-reset"],
    ["GET", "/api/auth/reset-password/abc"],
    ["POST", "/api/auth/list-sessions"],
    ["GET", "/api/auth/sign-in/email"],
    ["POST", "/api/auth/get-session"],
  ])("bloqueia %s %s", (method, path) => {
    expect(isAllowedAuthRequest(request(method, path))).toBe(false);
  });

  it.each([
    "/api/auth/sign-in/email/",
    "/api/auth//sign-in/email",
    "/api/auth/sign-in%2Femail",
    "/api/auth/SIGN-IN/EMAIL",
    "/api/auth/sign-in/email/../../update-user",
    "/api/authx/sign-in/email",
  ])("bloqueia variação de caminho %s", (path) => {
    expect(isAllowedAuthRequest(request("POST", path))).toBe(false);
  });
});
