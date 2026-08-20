import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
};

function MapZoomControls({ onZoomIn, onZoomOut }: Props) {
  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity style={[styles.button, styles.buttonTop]} onPress={onZoomIn} activeOpacity={0.7}>
        <Text style={styles.buttonText}>+</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={onZoomOut} activeOpacity={0.7}>
        <Text style={styles.buttonText}>−</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    bottom: 12,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonTop: {
    marginBottom: 8,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 22,
  },
});

export default MapZoomControls;
