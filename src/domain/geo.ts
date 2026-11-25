export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_MILES = 3958.8;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceMiles(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MILES * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatMiles(miles: number): string {
  if (miles < 0.1) return 'nearby';
  return `${miles.toFixed(1)} mi`;
}

export function mapsPinUrl(point: LatLng, label: string): string {
  const query = encodeURIComponent(label);
  return `https://maps.google.com/?q=${point.lat},${point.lng}(${query})`;
}

export function mapsRouteUrl(stops: LatLng[]): string | null {
  if (stops.length === 0) return null;
  const first = stops[0];
  if (!first) return null;
  if (stops.length === 1) return mapsPinUrl(first, 'Job site');
  const last = stops[stops.length - 1];
  if (!last) return null;
  const waypoints = stops
    .slice(1, -1)
    .map((stop) => `${stop.lat},${stop.lng}`)
    .join('|');
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', `${first.lat},${first.lng}`);
  url.searchParams.set('destination', `${last.lat},${last.lng}`);
  url.searchParams.set('travelmode', 'driving');
  if (waypoints) url.searchParams.set('waypoints', waypoints);
  return url.toString();
}

export function phoneUrl(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  return `tel:${digits}`;
}
