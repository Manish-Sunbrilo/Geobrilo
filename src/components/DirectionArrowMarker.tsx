import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

type LatLng = { latitude: number; longitude: number };

type Props = {
  coordinate: LatLng;
  heading: number;
  color?: string;
};

/**
 * A heading-oriented arrow marker for the live "you are here, moving this
 * way" position -- the same directional-puck look used by Google Maps/Uber/
 * Ola while a ride/trip is actively tracking. `flat` keeps it rotating with
 * the map itself (not just facing the camera), so `rotation` (GPS heading,
 * 0 = north) actually points the arrow the right way.
 */
function DirectionArrowMarker({ coordinate, heading, color = '#4F46E5' }: Props) {
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} flat rotation={heading} title="Current position">
      <View style={styles.puck}>
        <View style={[styles.arrow, { borderBottomColor: color }]} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  puck: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: 2,
  },
});

export default DirectionArrowMarker;
