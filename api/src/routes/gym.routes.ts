import type { FastifyInstance, FastifyReply } from "fastify";
import type { BookingService } from "../services/booking.service.js";
import type { BookSlotRequest } from "../types/index.js";
import {
  GymNotFoundError,
  SlotNotFoundError,
  SlotFullError,
  DuplicateBookingError,
  ConcurrencyConflictError,
} from "../errors/index.js";

/**
 * Registers all gym-related routes on the given Fastify instance.
 *
 * Using a function that receives its dependencies (BookingService) rather
 * than importing them directly makes this trivially testable — you can
 * swap in a mock service for integration tests.
 */
export function registerGymRoutes(
  app: FastifyInstance,
  bookingService: BookingService,
): void {
  /* ── GET /gyms/:id/capacity ────────────────────────────────── */

  app.get<{ Params: { id: string } }>(
    "/gyms/:id/capacity",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      try {
        const capacity = await bookingService.getCapacity(request.params.id);
        return reply.code(200).send(capacity);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  /* ── POST /gyms/:id/book ───────────────────────────────────── */

  app.post<{ Params: { id: string }; Body: BookSlotRequest }>(
    "/gyms/:id/book",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            userId: { type: "string" },
            slotId: { type: "string" },
          },
          required: ["userId", "slotId"],
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await bookingService.bookSlot(
          request.params.id,
          request.body,
        );
        return reply.code(201).send(result);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );
}

/* ── Error → HTTP status mapping ───────────────────────────── */

function handleError(err: unknown, reply: FastifyReply): void {
  if (err instanceof GymNotFoundError || err instanceof SlotNotFoundError) {
    void reply.code(404).send({ error: (err as Error).message });
    return;
  }
  if (err instanceof SlotFullError) {
    void reply.code(422).send({ error: (err as Error).message });
    return;
  }
  if (err instanceof DuplicateBookingError) {
    void reply.code(409).send({ error: (err as Error).message });
    return;
  }
  if (err instanceof ConcurrencyConflictError) {
    void reply.code(409).send({ error: (err as Error).message });
    return;
  }

  // Unexpected — log and return 500
  console.error("Unhandled error:", err);
  void reply.code(500).send({ error: "Internal server error" });
}
