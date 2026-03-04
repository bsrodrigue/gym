import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface CapacityRingProps {
  /** 0–100 */
  percentage: number;
  /** Diameter in points */
  size?: number;
  /** Ring thickness */
  strokeWidth?: number;
  /** Label below the percentage, e.g. "34 / 50" */
  subtitle?: string;
}

/**
 * Animated circular progress indicator for gym capacity.
 *
 * The ring colour shifts from green → amber → red as the percentage
 * increases, giving users an instant visual cue.
 *
 * SVG approach chosen over Canvas because react-native-svg is well
 * supported on both iOS and Android and doesn't require a bridge
 * to native Canvas APIs.
 */
export function CapacityRing({
  percentage,
  size = 180,
  strokeWidth = 14,
  subtitle,
}: CapacityRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (percentage / 100) * circumference;
  const gap = circumference - filled;

  const colour = getColourForPercentage(percentage);

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#2a2a3d"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Filled arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colour}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${filled} ${gap}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
        />
      </Svg>

      {/* Center label */}
      <View style={[styles.labelContainer, { width: size, height: size }]}>
        <Text style={[styles.percentageText, { color: colour }]}>
          {percentage}%
        </Text>
        {subtitle && <Text style={styles.subtitleText}>{subtitle}</Text>}
      </View>
    </View>
  );
}

function getColourForPercentage(pct: number): string {
  if (pct < 50) return "#4ade80"; // green
  if (pct < 80) return "#fbbf24"; // amber
  return "#f87171"; // red
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  labelContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  percentageText: {
    fontSize: 36,
    fontWeight: "700",
  },
  subtitleText: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 2,
  },
});
