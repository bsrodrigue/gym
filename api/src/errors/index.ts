/**
 * Domain-specific errors.
 *
 * Keeping them as distinct classes rather than generic Error(message)
 * lets route handlers map each to the correct HTTP status code without
 * parsing strings.
 */

export class GymNotFoundError extends Error {
  constructor(gymId: string) {
    super(`Gym "${gymId}" not found`);
    this.name = "GymNotFoundError";
  }
}

export class SlotNotFoundError extends Error {
  constructor(slotId: string) {
    super(`Slot "${slotId}" not found`);
    this.name = "SlotNotFoundError";
  }
}

export class SlotFullError extends Error {
  constructor(slotId: string) {
    super(`Slot "${slotId}" is fully booked`);
    this.name = "SlotFullError";
  }
}

export class DuplicateBookingError extends Error {
  constructor(userId: string, slotId: string) {
    super(`User "${userId}" already has a booking for slot "${slotId}"`);
    this.name = "DuplicateBookingError";
  }
}

/**
 * Thrown when an optimistic lock fails — meaning someone else mutated
 * the row between our read and our write. The caller should retry.
 */
export class ConcurrencyConflictError extends Error {
  constructor() {
    super("Concurrency conflict — please retry");
    this.name = "ConcurrencyConflictError";
  }
}
