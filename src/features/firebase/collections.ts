import { FieldValue } from 'firebase-admin/firestore';
import { firestore } from './firestore';

export const collections = {
  positions: firestore.collection('positions'),
  events: firestore.collection('events'),
  userPrefs: firestore.collection('user_prefs'),
  indexerCursors: firestore.collection('indexer_cursors'),
};

export const serverTimestamp = () => FieldValue.serverTimestamp();

export type PositionDocument = {
  host_pubkey: string;
  guest_pubkey: string;
  pair_id: string;
  leverage_x: number;
  split_host_bps: number;
  amount_host: number;
  amount_guest: number;
  price_open: number | null;
  price_close: number | null;
  state: 'open' | 'closed';
  opened_ledger: number | null;
  closed_ledger: number | null;
  created_at: FirebaseFirestore.Timestamp;
  updated_at: FirebaseFirestore.Timestamp;
};

export type EventDocument = {
  position_id: string;
  type: 'PositionCreated' | 'Deposited' | 'Opened' | 'Closed' | 'Withdrawn';
  ledger: number;
  tx_hash: string;
  payload: Record<string, unknown>;
  created_at: FirebaseFirestore.Timestamp;
};

export type IndexerCursorDocument = {
  cursor_value: string;
  updated_at: FirebaseFirestore.Timestamp;
};
