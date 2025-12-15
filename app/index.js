import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";

export default function ManualScanScreen() {
  const router = useRouter();
  const [barcode, setBarcode] = useState("");

  const handleLookup = () => {
    if (!barcode) return alert("Enter a barcode");
    router.push({
      pathname: "/result",
      params: { barcode }
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TRUVO Manual Input</Text>
      <Text style={styles.subtitle}>Enter a barcode</Text>

      <TextInput
        placeholder="123456789"
        value={barcode}
        onChangeText={setBarcode}
        style={styles.input}
        keyboardType="numeric"
      />

      {/* manual lookup */}
      <Button title="Lookup" onPress={handleLookup} />

      {/* NEW button: open camera scanner */}
      <View style={{ marginTop: 20 }}>
        <Button
          title="Scan with Camera"
          onPress={() => router.push("/scanCamera")}
        />
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 80 },
  title: { fontSize: 26, marginBottom: 10, fontWeight: "bold" },
  subtitle: { fontSize: 16, opacity: 0.8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    marginVertical: 20,
    fontSize: 18
  }
});
