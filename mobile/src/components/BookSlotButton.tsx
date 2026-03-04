import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import type { AsyncState, BookSlotResponse } from "../types";

interface BookSlotButtonProps {
  state: AsyncState<BookSlotResponse>;
  onPress: () => void;
  /** Called when the user wants to dismiss a success/error banner and retry */
  onReset: () => void;
}

/**
 * A button that reflects the full lifecycle of a booking attempt:
 *   idle    → "Book a Slot"
 *   loading → spinner
 *   success → "Booked ✓" (green, tapping resets)
 *   error   → error message (red, tapping resets to retry)
 */
export function BookSlotButton({
  state,
  onPress,
  onReset,
}: BookSlotButtonProps) {
  const isDisabled = state.status === "loading";

  const handlePress = () => {
    if (state.status === "success" || state.status === "error") {
      onReset();
      return;
    }
    onPress();
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          state.status === "success" && styles.successButton,
          state.status === "error" && styles.errorButton,
        ]}
        onPress={handlePress}
        disabled={isDisabled}
        activeOpacity={0.8}
      >
        {state.status === "loading" ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{getLabel(state)}</Text>
        )}
      </TouchableOpacity>

      {state.status === "error" && (
        <Text style={styles.errorMessage}>{state.message}</Text>
      )}

      {state.status === "success" && (
        <Text style={styles.successMessage}>
          {state.data.remainingSlots} slots remaining — tap to book another
        </Text>
      )}
    </>
  );
}

function getLabel(state: AsyncState<BookSlotResponse>): string {
  switch (state.status) {
    case "idle":
      return "Book a Slot";
    case "success":
      return "Booked ✓";
    case "error":
      return "Retry";
    default:
      return "Book a Slot";
  }
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#6366f1",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    marginTop: 24,
  },
  successButton: {
    backgroundColor: "#22c55e",
  },
  errorButton: {
    backgroundColor: "#ef4444",
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  errorMessage: {
    color: "#f87171",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
  successMessage: {
    color: "#4ade80",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
});
