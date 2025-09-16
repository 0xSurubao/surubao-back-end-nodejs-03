import SorobanClient, { xdr, rpc as SorobanRpc } from '@stellar/stellar-sdk';
import { env } from '../config/env';

export const sorobanServer = new SorobanRpc.Server(env.sorobanRpcUrl, {
    allowHttp: env.sorobanRpcUrl.startsWith('http://'),
});

export const nativeToScVal = SorobanClient.nativeToScVal as unknown as (
    value: unknown,
    opts?: Record<string, unknown>
) => xdr.ScVal;

export const scValToNative =
    typeof SorobanClient.scValToNative === 'function'
        ? (SorobanClient.scValToNative as (value: xdr.ScVal) => unknown)
        : undefined;
