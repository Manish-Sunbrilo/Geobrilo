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
  // iOS's Apple-Maps-backed Polyline doesn't reliably redraw when only its
  // `coordinates` prop changes (a known react-native-maps limitation) --
  // unlike Android, which updates the overlay in place fine. Keying each
  // Polyline on the point count forces React to unmount/remount it (a fresh
  // native overlay) whenever the path grows, so a live-growing route (e.g.
  // Track Me while walking) actually appears/updates on iOS, not just a
  // trip reviewed later as a single static render.
  const key = coordinates.length;
  return (
    <>
      <Polyline
        key={`casing-${key}`}
        coordinates={coordinates}
        strokeColor="#FFFFFF"
        strokeWidth={9}
        lineCap="round"
        lineJoin="round"
        zIndex={1}
      />
      <Polyline
        key={`line-${key}`}
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
