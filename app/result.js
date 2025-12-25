import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

const API_BASE = "https://truvo-backend.onrender.com";

export default function ResultScreen() {
  const { barcode } = useLocalSearchParams();

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!barcode) return;

    setData(null);
    setErr("");

    fetch(`${API_BASE}/scan?barcode=${encodeURIComponent(barcode)}`)
      .then((res) => res.json())
      .then(setData)
      .catch(() =>
        setErr("Could not reach backend. Check server & WiFi.")
      );
  }, [barcode]);

  if (err) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>{err}</Text>
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

  const { product, processing, diet } = data;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{product.product_name}</Text>

      <Text style={styles.section}>
        Processing level: {processing?.level}
      </Text>

      <Text style={styles.section}>
        Diet compatibility: {diet?.label ?? "—"}
      </Text>

      <Text style={styles.explain}>
        {processing?.reason}
      </Text>

      <Text style={styles.disclaimer}>
        Assessments are based on food processing signals and available information.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  container: { flex: 1, padding: 24, paddingTop: 60 },

  title: { fontSize: 26, fontWeight: "bold", marginBottom: 12 },

  section: { fontSize: 16, marginTop: 6 },

  explain: { marginTop: 14, opacity: 0.7 },

  disclaimer: {
    marginTop: 40,
    fontSize: 12,
    opacity: 0.5,
    lineHeight: 16,
  },

  err: { fontSize: 16, color: "red", padding: 20, textAlign: "center" },
});
