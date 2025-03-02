/**
 path finder processes the user-drawn path and simplifies it using the Ramer-Douglas-Peucker
 algorithm and then refines it using the Google Directions API to create a walkable/runnable
 route. The final path maintains the shape drawn while still following real-world roads and pathways.
 *
 */

import axios from "axios";
import Constants from "expo-constants";
import {getDistanceMeters} from './utils/navigationUtils';

const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey;
export const getPathFromPoints = async (points) => {
  if (points.length < 2) {
    throw new Error("At least 2 points are required");
  }

  try {
    if (points.length <= 10) {
      return await getShapePreservingPath(points);
    }

    return await getSegmentedPath(points);
  } catch (error) {
    console.error("Error in getPathFromPoints:", error);
    throw error;
  }
};

// Gets a path that closely follows the shape of drawn points
// uses google direction api (used to calculate optimal route between points
// and step by step navigation)

async function getShapePreservingPath(points) {
  try {
    const simplified = simplifyPath(points, 0.00008);

    const origin = simplified[0];
    const destination = simplified[simplified.length - 1];

    const waypoints = simplified.slice(1, -1);
    const maxWaypoints = Math.min(waypoints.length, 8);

    const sampledWaypoints = sampleWaypoints(waypoints, maxWaypoints);

    const waypointsStr = sampledWaypoints
      .map((p) => `via:${p.latitude},${p.longitude}`)
      .join("|");

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/directions/json",
      {
        params: {
          origin: `${origin.latitude},${origin.longitude}`,
          destination: `${destination.latitude},${destination.longitude}`,
          waypoints: waypointsStr,
          mode: "walking",
          key: GOOGLE_MAPS_API_KEY,
          optimizeWaypoints: false,
          alternatives: false,
        },
      }
    );

    if (response.data.status !== "OK") {
      throw new Error("Directions API error: " + response.data.status);
    }

    const route = response.data.routes[0];
    let polyline = decodePolyline(route.overview_polyline.points);

    let totalDistance = 0;
    let totalDuration = 0;
    route.legs.forEach((leg) => {
      totalDistance += leg.distance.value;
      totalDuration += leg.duration.value;
    });

    return {
      polyline,
      distance: totalDistance,
      duration: totalDuration,
      originalShape: points,
    };
  } catch (error) {
    console.error("Error getting shape-preserving path:", error);
    throw error;
  }
}

// For complex paths, break into segments and get directions for each segment
//  then combine the results.

async function getSegmentedPath(points) {
  const simplified = simplifyPath(points, 0.00008);

  const segments = [];
  for (let i = 0; i < simplified.length - 1; i += 8) {
    const end = Math.min(i + 9, simplified.length);
    const segment = simplified.slice(i, end);
    if (segment.length >= 2) {
      segments.push(segment);
    }
  }

  if (
    segments.length > 1 &&
    segments[segments.length - 1][segments[segments.length - 1].length - 1] !==
      simplified[simplified.length - 1]
  ) {
    segments[segments.length - 1].push(simplified[simplified.length - 1]);
  }

  const results = [];
  let totalDistance = 0;
  let totalDuration = 0;

  for (const segment of segments) {
    const result = await getShapePreservingPath(segment);
    results.push(result);
    totalDistance += result.distance;
    totalDuration += result.duration;
  }

  let combinedPolyline = [];
  for (let i = 0; i < results.length; i++) {
    if (i === 0) {
      combinedPolyline = [...results[i].polyline];
    } else {
      combinedPolyline = [...combinedPolyline, ...results[i].polyline.slice(1)];
    }
  }

  return {
    polyline: combinedPolyline,
    distance: totalDistance,
    duration: totalDuration,
    originalShape: points,
  };
}

// Resamples the input path so that there is a point approximately every "interval" meters.
// Ensures the first and last points are preserved.

function resamplePath(points, interval) {
  if (points.length < 2) return points;

  const newPath = [points[0]];
  let accumulated = 0;

  for (let i = 1; i < points.length; i++) {
    let prev = points[i - 1];
    let curr = points[i];
    let segmentDistance = getDistanceMeters(prev, curr);

    while (accumulated + segmentDistance >= interval) {
      let remaining = interval - accumulated;
      let t = remaining / segmentDistance;
      const newLat = prev.latitude + (curr.latitude - prev.latitude) * t;
      const newLng = prev.longitude + (curr.longitude - prev.longitude) * t;
      const newPoint = { latitude: newLat, longitude: newLng };
      newPath.push(newPoint);
      segmentDistance -= remaining;
      prev = newPoint;
      accumulated = 0;
    }
    accumulated += segmentDistance;
  }

  const lastPoint = points[points.length - 1];
  const finalPoint = newPath[newPath.length - 1];
  if (
    finalPoint.latitude !== lastPoint.latitude ||
    finalPoint.longitude !== lastPoint.longitude
  ) {
    newPath.push(lastPoint);
  }

  return newPath;
}

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

// Calculates the perpendicular distance from a point to a line.

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

  return Math.abs((dy * lat0 - dx * lon0 + lat2 * lon1 - lon2 * lat1) / length);
}

// Samples waypoints to stay within API limits.
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

// Decodes a Google-encoded polyline into an array of lat/lng points.

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
