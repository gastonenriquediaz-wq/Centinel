import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1E3A8A" />
      <Text style={styles.text}>Cargando Centinel...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 16,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
});
