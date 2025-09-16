import { Express, Router } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { collections } from "../../features/firestore/firestore-service";
import { serializeEvent, serializePosition } from "../../features/utils/serializers";

const listSchema = z.object({
  owner: z.string().min(1, "owner is required"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const createPositionsRouter = () => {
  const router = Router();

  router.get("/", async (req, res) => {
    const parsed = listSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid query", details: parsed.error.issues });
    }

    try {
      const { owner, limit } = parsed.data;

      const [hostSnapshot, guestSnapshot] = await Promise.all([
        collections.positions
          .where("host_pubkey", "==", owner)
          .orderBy("updated_at", "desc")
          .limit(limit)
          .get(),
        collections.positions
          .where("guest_pubkey", "==", owner)
          .orderBy("updated_at", "desc")
          .limit(limit)
          .get(),
      ]);

      const combined = new Map<
        string,
        FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
      >();

      for (const doc of hostSnapshot.docs) {
        combined.set(doc.id, doc);
      }

      for (const doc of guestSnapshot.docs) {
        combined.set(doc.id, doc);
      }

      const sorted = Array.from(combined.values()).sort((a, b) => {
        const aTs = a.data()?.updated_at;
        const bTs = b.data()?.updated_at;
        const aMillis = aTs instanceof Timestamp ? aTs.toMillis() : 0;
        const bMillis = bTs instanceof Timestamp ? bTs.toMillis() : 0;
        return bMillis - aMillis;
      });

      const items = sorted
        .slice(0, limit)
        .map((doc) => serializePosition(doc))
        .filter(Boolean);

      return res.json(items);
    } catch (_err) {
      return res.status(500).json({ error: "Failed to fetch positions" });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const document = await collections.positions.doc(req.params.id).get();

      if (!document.exists) {
        return res.status(404).json({ error: "Position not found" });
      }

      const position = serializePosition(document);
      const eventsSnapshot = await collections.events
        .where("position_id", "==", req.params.id)
        .orderBy("created_at", "desc")
        .limit(10)
        .get();

      const events = eventsSnapshot.docs.map((doc) => serializeEvent(doc)).filter(Boolean);

      return res.json({ position, events });
    } catch (_err) {
      return res.status(500).json({ error: "Failed to load position" });
    }
  });

  return router;
};

export const registerPositionsRoutes = (app: Express) => {
  app.use("/positions", createPositionsRouter());
};