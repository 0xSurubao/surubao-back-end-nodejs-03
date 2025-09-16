import { Keypair, StrKey, WebAuth } from 'stellar-sdk';
import { env } from '../config/env';

const CHALLENGE_TIMEOUT_SECONDS = 60 * 5;

const serverKeypair = Keypair.fromSecret(env.sep10ServerSecret);

const isValidAccount = (accountId: string) =>
  StrKey.isValidEd25519PublicKey(accountId) || StrKey.isValidMed25519PublicKey(accountId);

export class Sep10Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Sep10Error';
  }
}

export const buildSep10Challenge = (clientAccountId: string) => {
  if (!isValidAccount(clientAccountId)) {
    throw new Sep10Error('Invalid Stellar account identifier');
  }

  const challengeXDR = WebAuth.buildChallengeTx(
    serverKeypair,
    clientAccountId,
    env.homeDomain,
    CHALLENGE_TIMEOUT_SECONDS,
    env.stellarNetworkPassphrase,
    env.webAuthDomain
  );

  const expiresAt = Math.floor(Date.now() / 1000) + CHALLENGE_TIMEOUT_SECONDS;

  return {
    challengeXDR,
    expiresAt,
    networkPassphrase: env.stellarNetworkPassphrase,
  };
};

export const verifySep10Challenge = (signedXDR: string, clientAccountId: string) => {
  if (!isValidAccount(clientAccountId)) {
    throw new Sep10Error('Invalid Stellar account identifier');
  }

  try {
    const { clientAccountID } = WebAuth.readChallengeTx(
      signedXDR,
      serverKeypair.publicKey(),
      env.stellarNetworkPassphrase,
      env.homeDomain,
      env.webAuthDomain
    );

    if (clientAccountId !== clientAccountID) {
      throw new Sep10Error('Challenge was not issued for provided account');
    }

    const signers = WebAuth.verifyChallengeTxSigners(
      signedXDR,
      serverKeypair.publicKey(),
      env.stellarNetworkPassphrase,
      [clientAccountId],
      env.homeDomain,
      env.webAuthDomain
    );

    if (!signers.includes(clientAccountId)) {
      throw new Sep10Error('Missing client signature');
    }

    return {
      clientAccountId,
      signers,
    };
  } catch (err) {
    if (err instanceof Sep10Error) {
      throw err;
    }

    throw new Sep10Error((err as Error).message ?? 'SEP-10 verification failed');
  }
};

export const getServerAccount = () => serverKeypair.publicKey();
