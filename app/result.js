import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

// 🔒 SINGLE SOURCE OF TRUTH — HARD CODE FOR REAL DEVICE
const API_BASE = "http://192.168.4.29:3000";

export default function ResultScreen() {
  const { barcode } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!barcode) return;

    setData(null);
    setErr("");

    console.log("📡 API_BASE:", API_BASE);
    console.log("🔎 Looking up barcode:", barcode);

    fetch(`${API_BASE}/scan?barcode=${encodeURIComponent(barcode)}`)
      .then((res) => res.json())
      .then((json) => {
        console.log("✅ Backend response:", json);
        setData(json);
      })
      .catch((e) => {
        console.error("❌ FETCH ERROR:", e);
        setErr(
          `Network request failed.\n\nCheck:\n1) node server.mjs is running\n2) iPhone + Mac on same WiFi\n3) API_BASE IP is correct\n\nAPI: ${API_BASE}`
        );
      });
  }, [barcode]);

  if (err) {
    return (
      <View style={styles.center}>
        <Text style={styles.errTitle}>Couldn’t reach backend</Text>
        <Text style={styles.errText}>{err}</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading product…</Text>
      </View>
    );
  }

  if (!data.found) {
    return (
      <View style={styles.center}>
        <Text>Product not found</Text>
      </View>
    );
  }

  const product = data.product;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{product.name}</Text>

      <Text>Processing Level: {data.processing?.level ?? "-"}</Text>
      <Text>Diet Score: {data.diet?.score ?? "-"}</Text>

      <Text style={{ marginTop: 12, fontWeight: "bold" }}>
        Final Score: {data.score ?? "-"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 22,
    marginBottom: 10,
    fontWeight: "bold",
  },
  errTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  errText: {
    opacity: 0.85,
    textAlign: "center",
    lineHeight: 20,
  },
});
