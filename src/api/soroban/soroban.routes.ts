import { Router } from 'express';
import { Operation, TransactionBuilder } from 'soroban-client';
import { z } from 'zod';
import { env } from '../../features/config/env';
import { logger } from '../../features/config/logger';
import { optionalJwt } from '../../features/auth/auth-middleware';
import { sorobanRateLimiter } from '../../features/rate-limit/rate-limit';
import { nativeToScVal, sorobanServer } from '../../features/soroban/soroban-service';
import { getServerKeypair } from '../../features/stellar/sep10';

const requestSchema = z.object({
  contractId: z.string().min(1, 'contractId is required'),
  method: z.string().min(1, 'method is required'),
  args: z.array(z.unknown()).default([]),
  fee: z.coerce.number().int().min(100).default(100000),
  timeoutSecs: z.coerce.number().int().min(1).max(300).default(60),
});

export const sorobanRouter = Router();

sorobanRouter.use(optionalJwt);

sorobanRouter.post('/prepare/invoke', sorobanRateLimiter, async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
  }

  try {
    const { contractId, method, args, fee, timeoutSecs } = parsed.data;
    const serverKeypair = getServerKeypair();
    const sourceAccount = await sorobanServer.getAccount(serverKeypair.publicKey());

    let scArgs;
    try {
      scArgs = args.map((value) => nativeToScVal(value));
    } catch (_err) {
      return res.status(400).json({ error: 'Unable to convert arguments to Soroban values' });
    }

    const baseTransaction = new TransactionBuilder(sourceAccount, {
      fee: fee.toString(),
      networkPassphrase: env.stellarNetworkPassphrase,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: contractId,
          function: method,
          args: scArgs,
        })
      )
      .setTimeout(timeoutSecs)
      .build();

    const prepared = (await sorobanServer.prepareTransaction(
      baseTransaction,
      env.stellarNetworkPassphrase
    )) as typeof baseTransaction;

    const validUntil = prepared.timeBounds?.maxTime ? Number(prepared.timeBounds.maxTime) : null;

    return res.json({
      unsignedXDR: prepared.toXDR(),
      suggestedFee: Number(prepared.fee),
      validUntil,
      networkPassphrase: env.stellarNetworkPassphrase,
    });
  } catch (_err) {
    logger.error({ err: _err }, 'Failed to prepare Soroban invocation');
    return res.status(502).json({ error: 'Soroban RPC error' });
  }
});
