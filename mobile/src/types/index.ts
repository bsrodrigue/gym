/**
 * Shared types between the mobile app and the API.
 *
 * In a real monorepo we'd publish these from the api package,
 * but duplicating them here keeps the two packages decoupled
 * for this exercise. A future improvement would be a shared
 * `@gym/types` package.
 */

export interface CapacityResponse {
  gymId: string;
  name: string;
  currentOccupancy: number;
  maxCapacity: number;
  capacityPercentage: number;
}

export interface Booking {
  id: string;
  gymId: string;
  userId: string;
  slotId: string;
  createdAt: string;
  status: "confirmed" | "cancelled";
}

export interface BookSlotResponse {
  booking: Booking;
  remainingSlots: number;
}

export interface TimeSlot {
  id: string;
  gymId: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  bookedCount: number;
}

/**
 * Discriminated union for async operation state.
 *
 * This eliminates impossible states: you can never have isLoading=true
 * and error="something" at the same time, which is a real bug factory
 * when using separate boolean flags.
 */
export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string };
