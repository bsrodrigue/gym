import { v4 as uuidv4 } from "uuid";
import type { GymRepository } from "../repositories/gym.repository.js";
import type {
  CapacityResponse,
  BookSlotRequest,
  BookSlotResponse,
  Booking,
} from "../types/index.js";
import {
  GymNotFoundError,
  SlotNotFoundError,
  SlotFullError,
  DuplicateBookingError,
  ConcurrencyConflictError,
} from "../errors/index.js";

const MAX_RETRIES = 3;

/**
 * Encapsulates all business rules around gym capacity and slot booking.
 *
 * The booking flow uses optimistic concurrency control:
 *
 *   1. Read the slot and note its `version`.
 *   2. Validate business rules (not full, no duplicate booking).
 *   3. Ask the repository to persist — it will reject if the version changed.
 *   4. On ConcurrencyConflictError, retry from step 1 (up to MAX_RETRIES).
 *
 * This mirrors what we'd do with DynamoDB ConditionExpressions or a
 * Postgres advisory/row lock in production.
 */
export class BookingService {
  constructor(private readonly repo: GymRepository) {}

  async getCapacity(gymId: string): Promise<CapacityResponse> {
    const gym = await this.repo.findGymById(gymId);
    if (!gym) throw new GymNotFoundError(gymId);

    const percentage = Math.round(
      (gym.currentOccupancy / gym.maxCapacity) * 100,
    );

    return {
      gymId: gym.id,
      name: gym.name,
      currentOccupancy: gym.currentOccupancy,
      maxCapacity: gym.maxCapacity,
      capacityPercentage: percentage,
    };
  }

  async bookSlot(
    gymId: string,
    request: BookSlotRequest,
  ): Promise<BookSlotResponse> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.tryBookSlot(gymId, request);
      } catch (err) {
        if (err instanceof ConcurrencyConflictError) {
          lastError = err;
          // Retry — another request snuck in between our read and write.
          continue;
        }
        // Any other error (SlotFull, DuplicateBooking, etc.) is not retryable.
        throw err;
      }
    }

    // If we exhausted retries, surface the conflict to the caller.
    throw lastError ?? new ConcurrencyConflictError();
  }

  /* ── Private ───────────────────────────────────────────────── */

  private async tryBookSlot(
    gymId: string,
    request: BookSlotRequest,
  ): Promise<BookSlotResponse> {
    const gym = await this.repo.findGymById(gymId);
    if (!gym) throw new GymNotFoundError(gymId);

    const slot = await this.repo.findSlotById(request.slotId);
    if (!slot || slot.gymId !== gymId) {
      throw new SlotNotFoundError(request.slotId);
    }

    if (slot.bookedCount >= slot.maxCapacity) {
      throw new SlotFullError(request.slotId);
    }

    // Prevent the same user from double-booking the same slot.
    const existing = await this.repo.findBookingByUserAndSlot(
      request.userId,
      request.slotId,
    );
    if (existing) {
      throw new DuplicateBookingError(request.userId, request.slotId);
    }

    const booking: Booking = {
      id: uuidv4(),
      gymId,
      userId: request.userId,
      slotId: request.slotId,
      createdAt: new Date(),
      status: "confirmed",
    };

    // This is where the optimistic lock is enforced — the repo checks
    // `slot.version` against what's currently stored.
    const bookedBefore = slot.bookedCount;
    await this.repo.createBooking(booking, slot, slot.version);

    return {
      booking,
      remainingSlots: slot.maxCapacity - bookedBefore - 1,
    };
  }
}
