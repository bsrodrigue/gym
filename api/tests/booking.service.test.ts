import { describe, it, expect, beforeEach } from "vitest";
import { BookingService } from "../src/services/booking.service.js";
import { InMemoryGymRepository } from "../src/repositories/in-memory-gym.repository.js";
import {
  GymNotFoundError,
  SlotFullError,
  DuplicateBookingError,
} from "../src/errors/index.js";

describe("BookingService", () => {
  let service: BookingService;
  let repo: InMemoryGymRepository;

  beforeEach(() => {
    repo = new InMemoryGymRepository();
    service = new BookingService(repo);
  });

  /* ── getCapacity ───────────────────────────────────────────── */

  describe("getCapacity", () => {
    it("returns the correct capacity percentage", async () => {
      const result = await service.getCapacity("gym-1");

      expect(result.gymId).toBe("gym-1");
      expect(result.maxCapacity).toBe(50);
      expect(result.currentOccupancy).toBe(34);
      expect(result.capacityPercentage).toBe(68);
    });

    it("throws GymNotFoundError for an unknown gym", async () => {
      await expect(service.getCapacity("nonexistent")).rejects.toThrow(
        GymNotFoundError,
      );
    });
  });

  /* ── bookSlot ──────────────────────────────────────────────── */

  describe("bookSlot", () => {
    it("creates a confirmed booking and decrements remaining slots", async () => {
      const result = await service.bookSlot("gym-1", {
        userId: "user-1",
        slotId: "slot-1b", // has 3/20 booked, plenty of room
      });

      expect(result.booking.status).toBe("confirmed");
      expect(result.booking.userId).toBe("user-1");
      expect(result.booking.gymId).toBe("gym-1");
      expect(result.remainingSlots).toBe(16); // 20 - 3 - 1
    });

    it("throws SlotFullError when no slots remain", async () => {
      // slot-1a has 18/20 booked — fill the remaining 2 first
      await service.bookSlot("gym-1", {
        userId: "fill-1",
        slotId: "slot-1a",
      });
      await service.bookSlot("gym-1", {
        userId: "fill-2",
        slotId: "slot-1a",
      });

      // Now the slot is at 20/20
      await expect(
        service.bookSlot("gym-1", {
          userId: "user-too-late",
          slotId: "slot-1a",
        }),
      ).rejects.toThrow(SlotFullError);
    });

    it("prevents the same user from double-booking the same slot", async () => {
      await service.bookSlot("gym-1", {
        userId: "user-1",
        slotId: "slot-1b",
      });

      await expect(
        service.bookSlot("gym-1", {
          userId: "user-1",
          slotId: "slot-1b",
        }),
      ).rejects.toThrow(DuplicateBookingError);
    });

    it("throws GymNotFoundError when the gym doesn't exist", async () => {
      await expect(
        service.bookSlot("fake-gym", {
          userId: "user-1",
          slotId: "slot-1a",
        }),
      ).rejects.toThrow(GymNotFoundError);
    });

    /**
     * This is the critical concurrency test.
     *
     * We simulate two near-simultaneous bookings competing for the last
     * available slot. Thanks to the optimistic lock, exactly one should
     * succeed and the other should fail (with SlotFullError, after the
     * retry loop exhausts because every retry will see the slot as full).
     */
    it("handles concurrent booking attempts without overbooking", async () => {
      // slot-2a has 14/15 booked — 1 remaining slot
      const booking1 = service.bookSlot("gym-2", {
        userId: "racer-1",
        slotId: "slot-2a",
      });

      const booking2 = service.bookSlot("gym-2", {
        userId: "racer-2",
        slotId: "slot-2a",
      });

      const results = await Promise.allSettled([booking1, booking2]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // In our single-process in-memory setup, both promises resolve
      // synchronously on the microtask queue, so there's no actual
      // interleaving. One will succeed and the second will see the slot
      // as full (bookedCount === maxCapacity after the first write).
      //
      // In a real distributed system with DynamoDB conditional writes,
      // the second writer would get a ConditionalCheckFailedException
      // which maps to our ConcurrencyConflictError → retry → SlotFullError.
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Verify the slot wasn't overbooked
      const slot = await repo.findSlotById("slot-2a");
      expect(slot!.bookedCount).toBeLessThanOrEqual(slot!.maxCapacity);
    });
  });
});
