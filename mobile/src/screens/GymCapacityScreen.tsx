import React, { useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useGymCapacity } from "../hooks/useGymCapacity";
import { useBookSlot } from "../hooks/useBookSlot";
import { CapacityRing } from "../components/CapacityRing";
import { BookSlotButton } from "../components/BookSlotButton";

/**
 * For this exercise we hardcode the gym and user ID. In production,
 * the gym would come from navigation params or a nearby-gym lookup,
 * and the user from the auth context.
 */
const GYM_ID = "gym-1";
const USER_ID = "user-demo";
const SLOT_ID = "slot-1b";

export function GymCapacityScreen() {
  const { state: capacityState, refetch } = useGymCapacity(GYM_ID);
  const { state: bookingState, book, reset } = useBookSlot(GYM_ID);

  const handleBook = useCallback(() => {
    book(USER_ID, SLOT_ID);
  }, [book]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={capacityState.status === "loading"}
            onRefresh={handleRefresh}
            tintColor="#6366f1"
          />
        }
      >
        <Text style={styles.heading}>Live Capacity</Text>

        {capacityState.status === "loading" && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Fetching capacity…</Text>
          </View>
        )}

        {capacityState.status === "error" && (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{capacityState.message}</Text>
          </View>
        )}

        {capacityState.status === "success" && (
          <>
            <Text style={styles.gymName}>{capacityState.data.name}</Text>

            <View style={styles.ringWrapper}>
              <CapacityRing
                percentage={capacityState.data.capacityPercentage}
                subtitle={`${capacityState.data.currentOccupancy} / ${capacityState.data.maxCapacity}`}
              />
            </View>

            <View style={styles.infoRow}>
              <InfoCard
                label="Current"
                value={String(capacityState.data.currentOccupancy)}
              />
              <InfoCard
                label="Max"
                value={String(capacityState.data.maxCapacity)}
              />
            </View>

            <BookSlotButton
              state={bookingState}
              onPress={handleBook}
              onReset={reset}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Small helper (doesn't warrant its own file) ───────────── */

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0f0f1a",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  gymName: {
    fontSize: 18,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 24,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  loadingText: {
    color: "#94a3b8",
    marginTop: 12,
    fontSize: 15,
  },
  errorText: {
    color: "#f87171",
    fontSize: 15,
    textAlign: "center",
  },
  ringWrapper: {
    alignItems: "center",
    marginBottom: 32,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  card: {
    backgroundColor: "#1e1e2f",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: "center",
    minWidth: 100,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  cardLabel: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },
});
