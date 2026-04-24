import jwt, { type JwtPayload } from "jsonwebtoken";

const authSecret =
  process.env.JWT_SECRET ??
  (process.env.NODE_ENV !== "production" ? "chatapp-dev-secret" : undefined);
const authCookieName = "chatapp_token";
const authMaxAgeSeconds = 60 * 60;

export type AuthTokenPayload = JwtPayload & {
  userId: string;
  email: string;
  username: string;
};

export function getAuthCookieName() {
  return authCookieName;
}

export function getAuthMaxAgeSeconds() {
  return authMaxAgeSeconds;
}

export function signAuthToken(payload: AuthTokenPayload) {
  if (!authSecret) {
    throw new Error("Missing JWT_SECRET environment variable.");
  }

  return jwt.sign(payload, authSecret, {
    expiresIn: authMaxAgeSeconds,
  });
}

export function verifyAuthToken(token: string) {
  if (!authSecret) {
    throw new Error("Missing JWT_SECRET environment variable.");
  }

  return jwt.verify(token, authSecret) as AuthTokenPayload;
}