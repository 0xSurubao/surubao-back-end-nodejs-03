import jwt from "jsonwebtoken";
import { env } from "../config/env";

type AccessTokenPayload = {
  sub: string;
  scopes: string[];
};

type VerifyResult = AccessTokenPayload & {
  exp: number;
  iat: number;
};

export const issueAccessToken = (subject: string, scopes: string[] = []) => {
  const expiresAt = Math.floor(Date.now() / 1000) + env.jwtExpiresSeconds;
  const token = jwt.sign({ sub: subject, scopes }, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: env.jwtExpiresSeconds,
  });

  return { token, expiresAt };
};

export const verifyAccessToken = (token: string): VerifyResult => {
  const payload = jwt.verify(token, env.jwtSecret, {
    algorithms: ["HS256"],
  }) as jwt.JwtPayload;

  if (!payload.sub) {
    throw new Error("Token payload missing subject");
  }

  return {
    sub: payload.sub,
    scopes: (payload.scopes as string[]) ?? [],
    exp: payload.exp as number,
    iat: payload.iat as number,
  };
};