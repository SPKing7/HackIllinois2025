import axios from "axios";

// This API key would need to be replaced with a valid one
// and should be stored securely in a real app
const GOOGLE_MAPS_API_KEY = "AIzaSyCOoH6FrJx05wpCXIr0yzGABy3LdEG7T80";

/**
 * Gets a walkable path from a series of drawn points using Google Directions API
 * @param {Array} points - Array of lat/lng coordinates from drawn path
 * @returns {Promise<Array>} - Array of lat/lng coordinates for walkable path
 */
export const getPathFromPoints = async (points) => {
  if (points.length < 2) {
    throw new Error("At least 2 points are required");
  }

  // For a real implementation, we would use the actual Google Directions API
  // However, for demo purposes, we'll approximate the route

  // In a real app, you would:
  // 1. Simplify the drawn path to reduce the number of waypoints
  // 2. Extract key waypoints (like corners, start, end)
  // 3. Call the Google Directions API with these waypoints

  try {
    // Demo implementation: Sample how a real implementation might work
    const simplified = simplifyPath(points, 0.0001); // Simplify to reduce API calls

    // Extract origin, destination and waypoints
    const origin = simplified[0];
    const destination = simplified[simplified.length - 1];

    // Get up to 8 waypoints (Google Directions API limit for free tier)
    const waypoints = simplified.slice(1, -1);
    const sampledWaypoints = sampleWaypoints(waypoints, 8);

    // Example of how you would call the Google Directions API
    // In a real app, we'd use the result from this API call
    /* 
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: `${origin.latitude},${origin.longitude}`,
        destination: `${destination.latitude},${destination.longitude}`,
        waypoints: sampledWaypoints.map(p => `${p.latitude},${p.longitude}`).join('|'),
        mode: 'walking',
        key: GOOGLE_MAPS_API_KEY
      }
    });
    
    // Process the directions response to extract the path
    // (This would parse the route and extract the polyline points)
    return decodePolyline(response.data.routes[0].overview_polyline.points);
    */

    // For this demo, we'll just create a smoother path based on the input
    return createSmoothPath(simplified);
  } catch (error) {
    console.error("Error in getPathFromPoints:", error);
    throw error;
  }
};

/**
 * Simplifies a path using the Ramer-Douglas-Peucker algorithm
 */
function simplifyPath(points, epsilon) {
  if (points.length <= 2) {
    return points;
  }

  // Find the point with the maximum distance
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

  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    const firstPart = simplifyPath(points.slice(0, index + 1), epsilon);
    const secondPart = simplifyPath(points.slice(index), epsilon);
    return [...firstPart.slice(0, -1), ...secondPart];
  } else {
    return [points[0], points[points.length - 1]];
  }
}

/**
 * Calculate perpendicular distance from a point to a line
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const lat1 = lineStart.latitude;
  const lon1 = lineStart.longitude;
  const lat2 = lineEnd.latitude;
  const lon2 = lineEnd.longitude;
  const lat0 = point.latitude;
  const lon0 = point.longitude;

  // Simple 2D distance calculation
  const dx = lat2 - lat1;
  const dy = lon2 - lon1;

  // Find the length of the line
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    // Line is actually a point, return distance to that point
    return Math.sqrt(Math.pow(lat0 - lat1, 2) + Math.pow(lon0 - lon1, 2));
  }

  // Calculate perpendicular distance
  const dist = Math.abs(
    (dy * lat0 - dx * lon0 + lat2 * lon1 - lon2 * lat1) / length
  );

  return dist;
}

/**
 * Sample waypoints to stay within API limits
 */
function sampleWaypoints(waypoints, maxCount) {
  if (waypoints.length <= maxCount) {
    return waypoints;
  }

  const result = [];
  const step = waypoints.length / maxCount;

  for (let i = 0; i < maxCount; i++) {
    const index = Math.min(Math.floor(i * step), waypoints.length - 1);
    result.push(waypoints[index]);
  }

  return result;
}

/**
 * Create a smooth path by interpolating between points
 * This is just for demo purposes in the absence of the Google Directions API
 */
function createSmoothPath(points) {
  if (points.length <= 2) {
    return points;
  }

  const result = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    // Add some interpolated points
    const steps = 5; // Number of points to add between existing points
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
 * Decodes a Google encoded polyline into an array of lat/lng points
 * (This would be used in a real implementation with the Google Directions API)
 */
function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}
