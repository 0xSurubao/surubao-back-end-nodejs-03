import { Buffer } from 'node:buffer';
import { Timestamp } from 'firebase-admin/firestore';

import { rpc as SorobanRpc, xdr, scValToNative } from '@stellar/stellar-sdk'; // <-- 1) use o SDK novo
//               ^^^ alias "rpc" vira "SorobanRpc"

import { env } from '../config/env';
import { firestore } from '../firebase/firestore';
import { logger } from '../config/logger';
import { collections, EventDocument, serverTimestamp } from '../firebase/collections';

// ===== RPC server & type aliases =====
const sorobanServer = new SorobanRpc.Server(env.sorobanRpcUrl, { allowHttp: false });

// inferir tipos a partir da API real do Server (evita depender de tipos não exportados)
type RpcServer = InstanceType<typeof SorobanRpc.Server>;
type GetEventsParams = Parameters<RpcServer['getEvents']>[0];
type GetEventsResult = Awaited<ReturnType<RpcServer['getEvents']>>;
type RpcEvent = GetEventsResult['events'][number];







// import { Buffer } from 'node:buffer';
// import { SorobanRpc, xdr } from 'soroban-client';
// import { rpc as SorobanRpc, xdr, scValToNative } from 'stellar-sdk';
// const sorobanServer = new SorobanRpc.Server(env.sorobanRpcUrl, { allowHttp: false });
// type RpcServer = InstanceType<typeof SorobanRpc.Server>;
// type RpcEvent = Awaited<ReturnType<RpcServer['getEvents']>>['events'][number];

// import { Timestamp } from 'firebase-admin/firestore';
// import { env } from '../config/env';
// import { firestore } from '../firebase/firestore';
// import { logger } from '../config/logger';
// import { collections, EventDocument, serverTimestamp } from '../firebase/collections';
// import { scValToNative, sorobanServer } from '../soroban/soroban-service';
// import { SorobanRpc, xdr, scValToNative } from '@stellar/soroban-client';
// import { rpc as SorobanRpc, xdr, scValToNative } from '@stellar/stellar-sdk';

const INDEXER_CURSOR_DOC_ID = 'soroban_events_cursor';
const POLL_INTERVAL_MS = 4000;
const MAX_BACKOFF_MS = 60000;
const EVENTS_LIMIT = 50;
const LOOKBACK_LEDGERS = 5000;

const allowedEventTypes: EventDocument['type'][] = [
    'PositionCreated',
    'Deposited',
    'Opened',
    'Closed',
    'Withdrawn',
];

const getEventPagingToken = (ev: RpcEvent): string | undefined => {
    const anyEv = ev as any;
    return anyEv?.pagingToken ?? anyEv?.paging_token ?? undefined;
};

type NormalizedEvent = {
    type: EventDocument['type'];
    positionId: string;
    ledger: number;
    ledgerClosedAt: string;
    txHash: string;
    payload: Record<string, unknown>;
};

const normalizeNative = (input: unknown): unknown => {
    if (input === null || input === undefined) {
        return input;
    }

    if (Array.isArray(input)) {
        return input.map((item) => normalizeNative(item));
    }

    if (input instanceof Map) {
        return Object.fromEntries(
            Array.from(input.entries()).map(([key, value]) => [key, normalizeNative(value)])
        );
    }

    if (input instanceof Uint8Array || input instanceof Buffer) {
        return Buffer.from(input).toString('base64');
    }

    if (typeof input === 'object') {
        return Object.fromEntries(
            Object.entries(input as Record<string, unknown>).map(([key, value]) => [
                key,
                normalizeNative(value),
            ])
        );
    }

    return input;
};

const decodeScVal = (value: xdr.ScVal): unknown => {
    if (scValToNative) {
        try {
            return normalizeNative(scValToNative(value));
        } catch (err) {
            logger.warn({ err }, 'Failed to convert ScVal via soroban-client helper');
        }
    }

    try {
        return value.toXDR('base64');
    } catch (err) {
        logger.error({ err }, 'Failed to encode ScVal payload');
        return null;
    }
};

const pickString = (source: Record<string, unknown>, keys: string[]): string | undefined => {
    for (const key of keys) {
        const value = source[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
        }
    }
    return undefined;
};

const pickNumber = (source: Record<string, unknown>, keys: string[]): number | undefined => {
    for (const key of keys) {
        const value = source[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string') {
            const parsed = Number(value);
            if (!Number.isNaN(parsed)) {
                return parsed;
            }
        }
    }
    return undefined;
};

const normalizeEvent = (event: RpcEvent): NormalizedEvent | null => {
    const decoded = decodeScVal(event.value);
    if (!decoded || typeof decoded !== 'object') return null;

    const payload = decoded as Record<string, unknown>;
    const typeRaw = pickString(payload, ['event_type', 'eventType', 'type']);
    if (!typeRaw || !allowedEventTypes.includes(typeRaw as EventDocument['type'])) return null;

    const positionId = pickString(payload, ['position_id', 'positionId', 'position']);
    if (!positionId) return null;

    const txHash = pickString(payload, ['tx_hash', 'txHash', 'transaction_hash']) ?? (event as any).id;
    const ledgerClosedAt = (event as any).ledgerClosedAt ?? new Date().toISOString();

    return {
        type: typeRaw as EventDocument['type'],
        positionId,
        ledger: (event as any).ledger,
        ledgerClosedAt,
        txHash,
        payload,
    };
};

const applyEventToPosition = async (event: NormalizedEvent) => {
    const docRef = collections.positions.doc(event.positionId);
    const eventTimestamp = Timestamp.fromDate(new Date(event.ledgerClosedAt));
    const data = event.payload;

    await firestore.runTransaction(async (tx) => {
        const snapshot = await tx.get(docRef);
        const update: Record<string, unknown> = {
            updated_at: serverTimestamp(),
        };

        if (!snapshot.exists) {
            update.created_at = eventTimestamp;
        }

        const host = pickString(data, ['host_pubkey', 'hostPubKey', 'host']);
        const guest = pickString(data, ['guest_pubkey', 'guestPubKey', 'guest']);
        const pairId = pickString(data, ['pair_id', 'pairId']);
        const leverage = pickNumber(data, ['leverage_x', 'leverage', 'leverageX']);
        const splitHostBps = pickNumber(data, ['split_host_bps', 'splitHostBps']);
        const amountHost = pickNumber(data, ['amount_host', 'amountHost']);
        const amountGuest = pickNumber(data, ['amount_guest', 'amountGuest']);
        const priceOpen = pickNumber(data, ['price_open', 'priceOpen']);
        const priceClose = pickNumber(data, ['price_close', 'priceClose']);

        if (host) update.host_pubkey = host;
        if (guest) update.guest_pubkey = guest;
        if (pairId) update.pair_id = pairId;
        if (typeof leverage === 'number') update.leverage_x = Math.trunc(leverage);
        if (typeof splitHostBps === 'number') update.split_host_bps = Math.trunc(splitHostBps);
        if (typeof amountHost === 'number') update.amount_host = Math.trunc(amountHost);
        if (typeof amountGuest === 'number') update.amount_guest = Math.trunc(amountGuest);

        switch (event.type) {
            case 'PositionCreated': {
                update.state = 'open';
                update.opened_ledger = data.opened_ledger ?? null;
                update.closed_ledger = data.closed_ledger ?? null;
                break;
            }
            case 'Opened': {
                update.state = 'open';
                update.opened_ledger = event.ledger;
                if (typeof priceOpen === 'number') {
                    update.price_open = priceOpen;
                }
                break;
            }
            case 'Closed': {
                update.state = 'closed';
                update.closed_ledger = event.ledger;
                if (typeof priceClose === 'number') {
                    update.price_close = priceClose;
                }
                break;
            }
            case 'Deposited': {
                if (data.deposit_side === 'host' && typeof amountHost === 'number') {
                    update.amount_host = Math.trunc(amountHost);
                }
                if (data.deposit_side === 'guest' && typeof amountGuest === 'number') {
                    update.amount_guest = Math.trunc(amountGuest);
                }
                break;
            }
            case 'Withdrawn': {
                if (typeof amountHost === 'number') {
                    update.amount_host = Math.trunc(amountHost);
                }
                if (typeof amountGuest === 'number') {
                    update.amount_guest = Math.trunc(amountGuest);
                }
                break;
            }
            default:
                break;
        }

        tx.set(docRef, update, { merge: true });
    });
};

const persistEvent = async (event: RpcEvent) => {
    const normalized = normalizeEvent(event);
    if (!normalized) {
        return;
    }

    const docRef = collections.events.doc(event.id);
    const createdAt = Timestamp.fromDate(new Date(event.ledgerClosedAt));

    await docRef.set(
        {
            position_id: normalized.positionId,
            type: normalized.type,
            ledger: normalized.ledger,
            tx_hash: normalized.txHash,
            payload: normalized.payload,
            created_at: createdAt,
        },
        { merge: true }
    );

    try {
        await applyEventToPosition(normalized);
    } catch (err) {
        logger.error(
            { err, positionId: normalized.positionId },
            'Failed to project event into position document'
        );
    }
};

const loadCursor = async () => {
    const snapshot = await collections.indexerCursors.doc(INDEXER_CURSOR_DOC_ID).get();
    if (!snapshot.exists) {
        return undefined;
    }

    const data = snapshot.data() as { cursor_value?: string } | undefined;
    return data?.cursor_value;
};

const saveCursor = async (cursor: string) => {
    await collections.indexerCursors.doc(INDEXER_CURSOR_DOC_ID).set(
        {
            cursor_value: cursor,
            updated_at: serverTimestamp(),
        },
        { merge: true }
    );
};

export const startSorobanIndexer = () => {
    if (env.contractIds.length === 0) {
        logger.warn('No contract IDs configured. Soroban indexer will remain idle.');
        return {
            stop: () => {
                logger.info('Soroban indexer idle stop invoked');
            },
        };
    }

    let stopped = false;
    let backoffMs = POLL_INTERVAL_MS;
    let scheduled: NodeJS.Timeout | undefined;
    let running = false;

    const scheduleNext = (delay: number) => {
        if (stopped) {
            return;
        }
        scheduled = setTimeout(() => {
            void tick();
        }, delay);
    };

    const tick = async () => {
        if (running || stopped) return;
        running = true;
        try {
            const cursor = await loadCursor();

            // Monte a request com startLedger OU cursor
            const req: GetEventsParams & { startLedger?: number } = {
                filters: [{ type: 'contract', contractIds: env.contractIds }],
                limit: EVENTS_LIMIT,
            };

            if (cursor && cursor.trim().length > 0) {
                req.cursor = cursor; // continua de onde parou
            } else {
                // primeira execução: derive um startLedger válido (evita "startLedger must be positive")
                const latest = await sorobanServer.getLatestLedger();
                const start = Math.max(1, (latest?.sequence ?? 1) - LOOKBACK_LEDGERS);
                req.startLedger = start; // <- sem @ts-expect-error, pois tipamos acima
            }

            const response = await sorobanServer.getEvents(req);
            const events = response.events ?? [];

            if (events.length === 0) {
                backoffMs = POLL_INTERVAL_MS;
                scheduleNext(POLL_INTERVAL_MS);
                return;
            }

            for (const event of events) {
                try { await persistEvent(event); }
                catch (err) { logger.error({ err, eventId: event.id }, 'Failed to persist Soroban event'); }
            }

            // const lastCursor = events[events.length - 1]?.pagingToken;
            const last = events[events.length - 1];
            const lastCursor = last ? getEventPagingToken(last) : undefined;

            if (lastCursor && lastCursor.trim().length > 0) {
                await saveCursor(lastCursor);
            }

            backoffMs = POLL_INTERVAL_MS;
            scheduleNext(POLL_INTERVAL_MS);
        } catch (err) {
            logger.error({ err }, 'Soroban events indexer cycle failed');
            backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
            scheduleNext(backoffMs);
        } finally {
            running = false;
        }
    };

    scheduleNext(0);

    logger.info({ contracts: env.contractIds }, 'Soroban events indexer started');

    return {
        stop: () => {
            stopped = true;
            if (scheduled) {
                clearTimeout(scheduled);
            }
            logger.info('Soroban events indexer stopped');
        },
    };
};
