import type { Gym, Booking, TimeSlot } from "../types/index.js";
import type { GymRepository } from "./gym.repository.js";
import { ConcurrencyConflictError, SlotFullError } from "../errors/index.js";

/**
 * In-memory implementation of GymRepository.
 *
 * This exists so we can develop and test without a running database.
 * The concurrency guarantees here are the same as what we'd get from a
 * DynamoDB conditional put or a Postgres row-level lock:
 *
 *   1. Read the current version of the slot.
 *   2. Attempt to write, but only if the version hasn't changed.
 *   3. If it changed, throw ConcurrencyConflictError so the service retries.
 *
 * In a single-process Node environment (which is single-threaded for JS
 * execution), the real risk is *async interleaving*: two requests read
 * the same version, then both try to write. The version check catches
 * exactly that case.
 */
export class InMemoryGymRepository implements GymRepository {
  private gyms: Map<string, Gym> = new Map();
  private slots: Map<string, TimeSlot> = new Map();
  private bookings: Map<string, Booking> = new Map();

  constructor() {
    this.seed();
  }

  async findGymById(gymId: string): Promise<Gym | null> {
    return this.gyms.get(gymId) ?? null;
  }

  async findSlotById(slotId: string): Promise<TimeSlot | null> {
    return this.slots.get(slotId) ?? null;
  }

  async findSlotsByGymId(gymId: string): Promise<TimeSlot[]> {
    return [...this.slots.values()].filter((s) => s.gymId === gymId);
  }

  async createBooking(
    booking: Booking,
    slot: TimeSlot,
    expectedVersion: number,
  ): Promise<void> {
    const current = this.slots.get(slot.id);
    if (!current) {
      throw new Error(`Slot ${slot.id} disappeared — this shouldn't happen`);
    }

    // Optimistic lock check
    if (current.version !== expectedVersion) {
      throw new ConcurrencyConflictError();
    }

    if (current.bookedCount >= current.maxCapacity) {
      throw new SlotFullError(slot.id);
    }

    // "Atomic" write — safe here because JS is single-threaded and we
    // haven't yielded the event loop between the check and the mutation.
    current.bookedCount += 1;
    current.version += 1;

    this.bookings.set(booking.id, booking);

    // Also bump the gym's live occupancy so the capacity endpoint
    // reflects the change immediately.
    const gym = this.gyms.get(slot.gymId);
    if (gym) {
      gym.currentOccupancy = Math.min(
        gym.currentOccupancy + 1,
        gym.maxCapacity,
      );
    }
  }

  async findBookingByUserAndSlot(
    userId: string,
    slotId: string,
  ): Promise<Booking | null> {
    for (const booking of this.bookings.values()) {
      if (
        booking.userId === userId &&
        booking.slotId === slotId &&
        booking.status === "confirmed"
      ) {
        return booking;
      }
    }
    return null;
  }

  /* ── Seed data ─────────────────────────────────────────────── */

  private seed(): void {
    const now = new Date();

    this.gyms.set("gym-1", {
      id: "gym-1",
      name: "Downtown Flex",
      maxCapacity: 50,
      currentOccupancy: 34,
      version: 1,
    });

    this.gyms.set("gym-2", {
      id: "gym-2",
      name: "Uptown Iron",
      maxCapacity: 30,
      currentOccupancy: 12,
      version: 1,
    });

    // Two slots for gym-1: one almost full, one wide open
    this.slots.set("slot-1a", {
      id: "slot-1a",
      gymId: "gym-1",
      startTime: new Date(now.getTime() + 3_600_000), // +1h
      endTime: new Date(now.getTime() + 7_200_000), // +2h
      maxCapacity: 20,
      bookedCount: 18,
      version: 1,
    });

    this.slots.set("slot-1b", {
      id: "slot-1b",
      gymId: "gym-1",
      startTime: new Date(now.getTime() + 7_200_000), // +2h
      endTime: new Date(now.getTime() + 10_800_000), // +3h
      maxCapacity: 20,
      bookedCount: 3,
      version: 1,
    });

    this.slots.set("slot-2a", {
      id: "slot-2a",
      gymId: "gym-2",
      startTime: new Date(now.getTime() + 3_600_000),
      endTime: new Date(now.getTime() + 7_200_000),
      maxCapacity: 15,
      bookedCount: 14,
      version: 1,
    });
  }
}
