import React from 'react';
import { Polyline } from 'react-native-maps';

type LatLng = { latitude: number; longitude: number };

type Props = {
  coordinates: LatLng[];
  color?: string;
};

/**
 * Google-Maps-style route line: a wider white "casing" beneath a narrower
 * colored line on top, both rounded -- this layered-stroke technique is
 * what actually gives a navigation app's route its polished look, versus a
 * single flat Polyline stroke.
 */
function RoutePolyline({ coordinates, color = '#4F46E5' }: Props) {
  if (coordinates.length < 2) {
    return null;
  }
  return (
    <>
      <Polyline
        coordinates={coordinates}
        strokeColor="#FFFFFF"
        strokeWidth={9}
        lineCap="round"
        lineJoin="round"
        zIndex={1}
      />
      <Polyline
        coordinates={coordinates}
        strokeColor={color}
        strokeWidth={6}
        lineCap="round"
        lineJoin="round"
        zIndex={2}
      />
    </>
  );
}

export default RoutePolyline;
