import { Express, Router } from "express";
import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { collections } from "../../features/firestore/firestore-service";
import { serializeEvent } from "../../features/utils/serializers";

const eventTypes = ["PositionCreated", "Deposited", "Opened", "Closed", "Withdrawn"] as const;

const listSchema = z.object({
  positionId: z.string().min(1).optional(),
  type: z.enum(eventTypes).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

const cursorSeparator = "_";

const parseCursor = (cursor?: string) => {
  if (!cursor) {
    return undefined;
  }

  const [millisString, docId] = cursor.split(cursorSeparator);
  const millis = Number(millisString);

  if (!docId || Number.isNaN(millis)) {
    throw new Error("Invalid cursor");
  }

  return { millis, docId };
};

const createEventsRouter = () => {
  const router = Router();

  router.get("/", async (req, res) => {
    const parsed = listSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid query", details: parsed.error.issues });
    }

    try {
      const { positionId, type, limit, cursor } = parsed.data;
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = collections.events
        .orderBy("created_at", "desc")
        .orderBy(FieldPath.documentId(), "desc");

      if (positionId) {
        query = query.where("position_id", "==", positionId);
      }

      if (type) {
        query = query.where("type", "==", type);
      }

      const parsedCursor = parseCursor(cursor);
      if (parsedCursor) {
        query = query.startAfter(Timestamp.fromMillis(parsedCursor.millis), parsedCursor.docId);
      }

      const snapshot = await query.limit(limit).get();
      const events = snapshot.docs.map((doc) => serializeEvent(doc)).filter(Boolean);

      let nextCursor: string | null = null;
      if (events.length === limit) {
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        const lastCreated = lastDoc.data()?.created_at;
        if (lastCreated instanceof Timestamp) {
          nextCursor = lastCreated.toMillis().toString() + cursorSeparator + lastDoc.id;
        }
      }

      return res.json({ events, nextCursor });
    } catch (err) {
      if (err instanceof Error && err.message === "Invalid cursor") {
        return res.status(400).json({ error: "Invalid cursor" });
      }

      return res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  return router;
};

export const registerEventsRoutes = (app: Express) => {
  app.use("/events", createEventsRouter());
};