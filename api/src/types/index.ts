/**
 * Core domain types for the gym capacity and booking system.
 *
 * The `version` field on Gym enables optimistic concurrency control:
 * every mutation increments this counter, and writers must present the
 * version they read to prove no one else mutated in between. This is
 * the same strategy DynamoDB uses with ConditionExpressions and what
 * PostgreSQL achieves through SELECT ... FOR UPDATE or explicit version cols.
 */

export interface Gym {
  id: string;
  name: string;
  maxCapacity: number;
  currentOccupancy: number;
  /** Monotonically increasing counter for optimistic locking. */
  version: number;
}

export interface TimeSlot {
  id: string;
  gymId: string;
  startTime: Date;
  endTime: Date;
  maxCapacity: number;
  bookedCount: number;
  version: number;
}

export interface Booking {
  id: string;
  gymId: string;
  userId: string;
  slotId: string;
  createdAt: Date;
  status: "confirmed" | "cancelled";
}

/* ── Request / Response shapes ─────────────────────────────── */

export interface CapacityResponse {
  gymId: string;
  name: string;
  currentOccupancy: number;
  maxCapacity: number;
  capacityPercentage: number;
}

export interface BookSlotRequest {
  userId: string;
  slotId: string;
}

export interface BookSlotResponse {
  booking: Booking;
  remainingSlots: number;
}
