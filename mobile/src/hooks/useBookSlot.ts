import { useState, useRef, useCallback } from "react";
import { API_BASE_URL } from "../config/api";
import type { BookSlotResponse, AsyncState } from "../types";

/**
 * Handles the slot booking action.
 *
 * Returns the current async state and a `book` function the caller
 * can invoke when the user taps "Book Slot". The state transitions
 * are: idle → loading → success | error.
 *
 * The `book` function is safe to call multiple times — it won't
 * fire duplicate requests while one is already in flight.
 */
export function useBookSlot(gymId: string) {
  const [state, setState] = useState<AsyncState<BookSlotResponse>>({
    status: "idle",
  });

  const inFlightRef = useRef(false);

  const book = useCallback(
    async (userId: string, slotId: string) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      setState({ status: "loading" });

      try {
        const response = await fetch(`${API_BASE_URL}/gyms/${gymId}/book`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, slotId }),
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(
            (body as { error?: string }).error ?? `HTTP ${response.status}`,
          );
        }

        setState({ status: "success", data: body as BookSlotResponse });
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Booking failed",
        });
      } finally {
        inFlightRef.current = false;
      }
    },
    [gymId],
  );

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return { state, book, reset };
}
