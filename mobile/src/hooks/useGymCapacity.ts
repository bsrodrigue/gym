import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE_URL } from "../config/api";
import type { CapacityResponse, AsyncState } from "../types";

const POLL_INTERVAL_MS = 10_000;

/**
 * Fetches and polls the live capacity for a given gym.
 *
 * Polls every 10 seconds by default. We use polling rather than
 * WebSockets here for simplicity and because capacity data doesn't
 * need sub-second freshness — a 10s delay is perfectly acceptable
 * for this use case.
 *
 * In production, you'd consider:
 *   - Server-Sent Events for one-directional real-time updates
 *   - WebSocket if bidirectional communication is needed
 *   - Push notifications for threshold alerts ("gym is now at 90%")
 */
export function useGymCapacity(gymId: string) {
  const [state, setState] = useState<AsyncState<CapacityResponse>>({
    status: "loading",
  });

  // Ref to track whether the component is still mounted, so we don't
  // set state after unmount (React warns about this).
  const mountedRef = useRef(true);

  const fetchCapacity = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/gyms/${gymId}/capacity`);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${response.status}`,
        );
      }

      const data: CapacityResponse = await response.json();

      if (mountedRef.current) {
        setState({ status: "success", data });
      }
    } catch (err) {
      if (mountedRef.current) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  }, [gymId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchCapacity();

    const interval = setInterval(fetchCapacity, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchCapacity]);

  return { state, refetch: fetchCapacity };
}
