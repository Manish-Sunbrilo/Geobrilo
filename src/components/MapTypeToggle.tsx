import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { MapType } from 'react-native-maps';

type Props = {
  mapType: MapType;
  onToggle: () => void;
};

function MapTypeToggle({ mapType, onToggle }: Props) {
  return (
    <TouchableOpacity style={styles.button} onPress={onToggle} activeOpacity={0.7}>
      <Text style={styles.icon}>{mapType === 'standard' ? '🛰️' : '🗺️'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 12,
    top: 12,
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
  icon: {
    fontSize: 18,
  },
});

export default MapTypeToggle;
