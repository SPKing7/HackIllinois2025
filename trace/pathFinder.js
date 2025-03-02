// pathFinder.js
import axios from "axios";
import Config from "react-native-config";


// Replace with your actual API key (store it securely in production)
const GOOGLE_MAPS_API_KEY = Config.GOOGLE_MAPS_API_KEY;

/**
 * Gets a walkable path from a series of drawn points using the Google Directions API.
 * Returns an object containing:
 *  - polyline: array of lat/lng coordinates for the walkable route
 *  - distance: total distance in meters
 *  - duration: total duration in seconds
 *
 * The drawn path is first simplified using the Ramer–Douglas–Peucker algorithm.
 *
 * @param {Array} points - Array of lat/lng coordinates from the drawn path
 * @returns {Promise<Object>}
 */
export const getPathFromPoints = async (points) => {
  if (points.length < 2) {
    throw new Error("At least 2 points are required");
  }

  try {
    // Simplify the path to reduce waypoints using Ramer–Douglas–Peucker
    const simplified = simplifyPath(points, 0.0001);

    // Extract origin, destination, and sample waypoints (up to 8)
    const origin = simplified[0];
    const destination = simplified[simplified.length - 1];
    const waypoints = simplified.slice(1, -1);
    const sampledWaypoints = sampleWaypoints(waypoints, 8);

    const waypointsStr = sampledWaypoints
      .map((p) => `${p.latitude},${p.longitude}`)
      .join("|");

    // Call the Google Directions API for walking directions
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/directions/json",
      {
        params: {
          origin: `${origin.latitude},${origin.longitude}`,
          destination: `${destination.latitude},${destination.longitude}`,
          waypoints: waypointsStr,
          mode: "walking",
          key: GOOGLE_MAPS_API_KEY,
        },
      }
    );

    if (response.data.status !== "OK") {
      throw new Error("Directions API error: " + response.data.status);
    }

    const route = response.data.routes[0];
    const polyline = decodePolyline(route.overview_polyline.points);

    // Sum distance and duration from all legs
    let totalDistance = 0;
    let totalDuration = 0;
    route.legs.forEach((leg) => {
      totalDistance += leg.distance.value;
      totalDuration += leg.duration.value;
    });

    return { polyline, distance: totalDistance, duration: totalDuration };
  } catch (error) {
    console.error("Error in getPathFromPoints:", error);
    throw error;
  }
};

/**
 * Simplifies a path using the Ramer–Douglas–Peucker algorithm.
 */
function simplifyPath(points, epsilon) {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance > epsilon) {
    const firstPart = simplifyPath(points.slice(0, index + 1), epsilon);
    const secondPart = simplifyPath(points.slice(index), epsilon);
    return [...firstPart.slice(0, -1), ...secondPart];
  } else {
    return [points[0], points[points.length - 1]];
  }
}

/**
 * Calculates the perpendicular distance from a point to a line.
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const lat1 = lineStart.latitude,
    lon1 = lineStart.longitude;
  const lat2 = lineEnd.latitude,
    lon2 = lineEnd.longitude;
  const lat0 = point.latitude,
    lon0 = point.longitude;

  const dx = lat2 - lat1;
  const dy = lon2 - lon1;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return Math.sqrt((lat0 - lat1) ** 2 + (lon0 - lon1) ** 2);

  const dist = Math.abs(
    (dy * lat0 - dx * lon0 + lat2 * lon1 - lon2 * lat1) / length
  );
  return dist;
}

/**
 * Samples waypoints to stay within API limits.
 */
function sampleWaypoints(waypoints, maxCount) {
  if (waypoints.length <= maxCount) return waypoints;

  const result = [];
  const step = waypoints.length / maxCount;
  for (let i = 0; i < maxCount; i++) {
    const index = Math.min(Math.floor(i * step), waypoints.length - 1);
    result.push(waypoints[index]);
  }
  return result;
}

/**
 * Creates a smooth path by interpolating between points.
 * Increased steps (10) produce a smoother “canvas” effect.
 */
function createSmoothPath(points) {
  if (points.length <= 2) return points;

  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const steps = 10; // More steps for a smoother curve
    for (let j = 1; j <= steps; j++) {
      const ratio = j / (steps + 1);
      result.push({
        latitude: prev.latitude + (curr.latitude - prev.latitude) * ratio,
        longitude: prev.longitude + (curr.longitude - prev.longitude) * ratio,
      });
    }
    result.push(curr);
  }
  return result;
}

/**
 * Decodes a Google-encoded polyline into an array of lat/lng points.
 */
function decodePolyline(encoded) {
  const points = [];
  let index = 0,
    lat = 0,
    lng = 0;

  while (index < encoded.length) {
    let shift = 0,
      result = 0,
      b;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }
  return points;
}
