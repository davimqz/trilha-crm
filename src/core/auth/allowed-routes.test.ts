import { describe, expect, it } from "vitest";

import { checkAuthRequest } from "./allowed-routes";

const request = (method: string, path: string, contentType = "application/json") =>
  new Request(`http://localhost:3000${path}`, {
    method,
    headers: method === "POST" ? { "content-type": contentType } : undefined,
  });

describe("checkAuthRequest", () => {
  it.each([
    ["GET", "/api/auth/get-session"],
    ["POST", "/api/auth/sign-in/email"],
    ["POST", "/api/auth/sign-out"],
    ["POST", "/api/auth/change-password"],
  ])("permite %s %s", (method, path) => {
    expect(checkAuthRequest(request(method, path))).toEqual({ allowed: true });
  });

  it.each([
    ["POST", "/api/auth/sign-up/email"],
    ["POST", "/api/auth/update-user"],
    ["POST", "/api/auth/request-password-reset"],
    ["GET", "/api/auth/reset-password/abc"],
    ["POST", "/api/auth/list-sessions"],
    ["GET", "/api/auth/sign-in/email"],
    ["POST", "/api/auth/get-session"],
  ])("bloqueia com 404 %s %s", (method, path) => {
    expect(checkAuthRequest(request(method, path))).toEqual({ allowed: false, status: 404 });
  });

  it.each([
    "/api/auth/sign-in/email/",
    "/api/auth//sign-in/email",
    "/api/auth/sign-in%2Femail",
    "/api/auth/SIGN-IN/EMAIL",
    "/api/auth/sign-in/email/../../update-user",
    "/api/authx/sign-in/email",
  ])("bloqueia variação de caminho %s", (path) => {
    expect(checkAuthRequest(request("POST", path))).toEqual({ allowed: false, status: 404 });
  });

  it.each(["application/x-www-form-urlencoded", "multipart/form-data; boundary=x", "text/plain", ""])(
    "recusa POST com content-type %j (415)",
    (contentType) => {
      expect(checkAuthRequest(request("POST", "/api/auth/sign-in/email", contentType))).toEqual({
        allowed: false,
        status: 415,
      });
    },
  );

  it("aceita application/json com charset", () => {
    expect(
      checkAuthRequest(request("POST", "/api/auth/sign-in/email", "Application/JSON; charset=utf-8")),
    ).toEqual({ allowed: true });
  });
});
