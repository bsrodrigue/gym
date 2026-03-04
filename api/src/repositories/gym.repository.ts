import type { Gym, Booking, TimeSlot } from "../types/index.js";

/**
 * Abstract contract for the persistence layer.
 *
 * Every method that mutates state accepts the `expectedVersion` the
 * caller saw at read-time. If the stored version doesn't match, the
 * implementation must throw a ConcurrencyConflictError so the service
 * layer can decide whether to retry or surface the error.
 *
 * This keeps the concurrency semantics explicit in the contract itself —
 * any new implementation (DynamoDB, Postgres, etc.) must honour them.
 */
export interface GymRepository {
  findGymById(gymId: string): Promise<Gym | null>;

  findSlotById(slotId: string): Promise<TimeSlot | null>;

  findSlotsByGymId(gymId: string): Promise<TimeSlot[]>;

  /**
   * Atomically increment the slot's `bookedCount` and persist the booking.
   *
   * @throws ConcurrencyConflictError when expectedVersion doesn't match.
   * @throws SlotFullError when the slot has no remaining capacity.
   */
  createBooking(
    booking: Booking,
    slot: TimeSlot,
    expectedVersion: number,
  ): Promise<void>;

  findBookingByUserAndSlot(
    userId: string,
    slotId: string,
  ): Promise<Booking | null>;
}
