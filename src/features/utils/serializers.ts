import { Timestamp } from "firebase-admin/firestore";
import { EventDocument, PositionDocument } from "../firestore/firestore-service";

const timestampToIso = (value?: FirebaseFirestore.Timestamp | null) =>
  value instanceof Timestamp ? value.toDate().toISOString() : null;

export const serializePosition = (
  doc: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>
) => {
  const data = doc.data() as Partial<PositionDocument> | undefined;
  if (!data) {
    return null;
  }

  return {
    id: doc.id,
    host_pubkey: data.host_pubkey ?? null,
    guest_pubkey: data.guest_pubkey ?? null,
    pair_id: data.pair_id ?? null,
    leverage_x: data.leverage_x ?? null,
    split_host_bps: data.split_host_bps ?? null,
    amount_host: data.amount_host ?? null,
    amount_guest: data.amount_guest ?? null,
    price_open: data.price_open ?? null,
    price_close: data.price_close ?? null,
    state: data.state ?? null,
    opened_ledger: data.opened_ledger ?? null,
    closed_ledger: data.closed_ledger ?? null,
    created_at: timestampToIso(data.created_at),
    updated_at: timestampToIso(data.updated_at),
  };
};

export const serializeEvent = (
  doc:
    | FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
    | FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>
) => {
  const data = doc.data() as Partial<EventDocument> | undefined;
  if (!data) {
    return null;
  }

  return {
    id: doc.id,
    position_id: data.position_id,
    type: data.type,
    ledger: data.ledger,
    tx_hash: data.tx_hash,
    payload: data.payload,
    created_at: timestampToIso(data.created_at),
  };
};