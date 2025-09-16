import 'express';

declare global {
  namespace Express {
    interface AuthenticatedUser {
      sub: string;
      scopes: string[];
      token: string;
      tokenExp: number;
    }

    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: Express.AuthenticatedUser;
  }
}

export {};
