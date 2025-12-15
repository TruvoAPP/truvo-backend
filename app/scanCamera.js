import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function ScanCamera() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text>Camera permission required</Text>
        <Text style={styles.link} onPress={requestPermission}>
          Allow camera
        </Text>
      </View>
    );
  }

  const handleBarcodeScanned = ({ data }) => {
    if (scanned) return;

    setScanned(true);
    setLoading(true);

    router.push({
      pathname: '/result',
      params: { barcode: data },
    });
  };

  return (
    <View style={{ flex: 1 }}>
      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 10 }}>Looking up product…</Text>
        </View>
      )}

      <CameraView
        style={{ flex: 1 }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {!scanned && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>Point camera at barcode</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  link: {
    marginTop: 10,
    color: 'blue',
  },
  overlay: {
    position: 'absolute',
    zIndex: 10,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 8,
  },
  hintText: {
    color: 'white',
    fontSize: 16,
  },
});
