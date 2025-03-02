import axios from "axios";
import Constants from "expo-constants";

// Replace with your actual API key (store it securely in production)
const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey;

/**
 * Gets a walkable path from a series of drawn points using the Google Directions API.
 * Returns an object containing:
 *  - polyline: array of lat/lng coordinates for the walkable route
 *  - distance: total distance in meters
 *  - duration: total duration in seconds
 *  - directions: array of turn-by-turn direction instructions
 *
 * @param {Array} points - Array of lat/lng coordinates from the drawn path
 * @returns {Promise<Object>}
 */
export const getPathFromPoints = async (points) => {
  if (points.length < 2) {
    throw new Error("At least 2 points are required");
  }

  try {
    // First option: if few points were drawn, use them all directly
    if (points.length <= 10) {
      return await getShapePreservingPath(points);
    }

    // Otherwise, divide and conquer approach for more complex paths
    return await getSegmentedPath(points);
  } catch (error) {
    console.error("Error in getPathFromPoints:", error);
    throw error;
  }
};

/**
 * Gets directions from current location to the start point of a route.
 * Returns an object containing polyline, distance, duration, and turn-by-turn directions.
 *
 * @param {Object} currentLocation - Current user location {latitude, longitude}
 * @param {Object} startPoint - Starting point of the route {latitude, longitude}
 * @returns {Promise<Object>}
 */
export const getDirectionsToStart = async (currentLocation, startPoint) => {
  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/directions/json",
      {
        params: {
          origin: `${currentLocation.latitude},${currentLocation.longitude}`,
          destination: `${startPoint.latitude},${startPoint.longitude}`,
          mode: "walking",
          key: GOOGLE_MAPS_API_KEY,
        },
      }
    );

    if (response.data.status !== "OK") {
      throw new Error("Directions API error: " + response.data.status);
    }

    // Process the response
    const route = response.data.routes[0];
    const polyline = decodePolyline(route.overview_polyline.points);

    // Calculate total distance and duration
    let totalDistance = 0;
    let totalDuration = 0;

    // Extract turn-by-turn directions
    let directions = [];

    route.legs.forEach((leg) => {
      totalDistance += leg.distance.value;
      totalDuration += leg.duration.value;

      // Process steps into directions
      leg.steps.forEach((step) => {
        directions.push({
          instruction: step.html_instructions.replace(/<[^>]*>/g, " ").trim(),
          distance: step.distance,
          duration: step.duration,
          start_location: step.start_location,
          end_location: step.end_location,
          maneuver: step.maneuver || "straight",
        });
      });
    });

    return {
      polyline,
      distance: totalDistance,
      duration: totalDuration,
      directions,
    };
  } catch (error) {
    console.error("Error getting directions to start:", error);
    throw error;
  }
};

/**
 * Gets a path that closely follows the shape of drawn points
 * by using more waypoints and segment-by-segment direction requests.
 */
async function getShapePreservingPath(points) {
  try {
    // Less aggressive simplification to preserve more details
    const simplified = simplifyPath(points, 0.00008); // Lower epsilon = more detail

    // Use start and end for origin/destination
    const origin = simplified[0];
    const destination = simplified[simplified.length - 1];

    // Use more waypoints (up to 10 for Google Directions API limits)
    const waypoints = simplified.slice(1, -1);
    const maxWaypoints = Math.min(waypoints.length, 8); // Google API limit is 10 (including start/end)

    // Sample waypoints more densely to maintain the shape
    const sampledWaypoints = sampleWaypoints(waypoints, maxWaypoints);

    // Force each waypoint to be respected exactly (via:) to maintain the drawn shape
    const waypointsStr = sampledWaypoints
      .map((p) => `via:${p.latitude},${p.longitude}`)
      .join("|");

    // Call Google Directions API with shape-preserving parameters
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/directions/json",
      {
        params: {
          origin: `${origin.latitude},${origin.longitude}`,
          destination: `${destination.latitude},${destination.longitude}`,
          waypoints: waypointsStr,
          mode: "walking",
          key: GOOGLE_MAPS_API_KEY,
          optimizeWaypoints: false, // do NOT optimize the waypoint order
          alternatives: false, // Don't provide alternative routes
        },
      }
    );

    if (response.data.status !== "OK") {
      throw new Error("Directions API error: " + response.data.status);
    }

    // Process the response to get polyline, distance, duration
    const route = response.data.routes[0];
    let polyline = decodePolyline(route.overview_polyline.points);

    // Calculate total distance and duration
    let totalDistance = 0;
    let totalDuration = 0;

    // Extract turn-by-turn directions
    let directions = [];

    route.legs.forEach((leg) => {
      totalDistance += leg.distance.value;
      totalDuration += leg.duration.value;

      // Process steps into directions
      leg.steps.forEach((step) => {
        directions.push({
          instruction: step.html_instructions.replace(/<[^>]*>/g, " ").trim(),
          distance: step.distance,
          duration: step.duration,
          start_location: step.start_location,
          end_location: step.end_location,
          maneuver: step.maneuver || "straight",
        });
      });
    });

    return {
      polyline,
      distance: totalDistance,
      duration: totalDuration,
      directions,
      originalShape: points, // Include original
    };
  } catch (error) {
    console.error("Error in getShapePreservingPath:", error);
    throw error;
  }
}

/**
 * Gets a path by splitting the points into segments and merging the results.
 * This approach is useful for more complex or longer paths.
 */
async function getSegmentedPath(points) {
  // Define maximum points per segment
  const MAX_POINTS_PER_SEGMENT = 10;
  let fullPath = [];
  let totalDistance = 0;
  let totalDuration = 0;
  let allDirections = [];

  for (let i = 0; i < points.length - 1; i += MAX_POINTS_PER_SEGMENT - 1) {
    // Get segment points, ensuring overlapping between segments
    const segmentPoints = points.slice(i, i + MAX_POINTS_PER_SEGMENT);
    if (segmentPoints.length < 2) break;
    const segmentResult = await getShapePreservingPath(segmentPoints);
    // Merge paths, avoid duplicate point at segment boundaries
    if (fullPath.length > 0) {
      fullPath = fullPath.concat(segmentResult.polyline.slice(1));
    } else {
      fullPath = segmentResult.polyline;
    }
    totalDistance += segmentResult.distance;
    totalDuration += segmentResult.duration;
    allDirections = allDirections.concat(segmentResult.directions);
  }

  return {
    polyline: fullPath,
    distance: totalDistance,
    duration: totalDuration,
    directions: allDirections,
    originalShape: points,
  };
}

/**
 * Decodes a Google Maps encoded polyline string into an array of coordinates.
 * @param {string} encoded - The encoded polyline string.
 * @returns {Array<{latitude: number, longitude: number}>} - Array of coordinate objects.
 */
function decodePolyline(encoded) {
  let points = [];
  let index = 0,
    len = encoded.length;
  let lat = 0,
    lng = 0;

  while (index < len) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

/**
 * Simplifies a path using the Ramer-Douglas-Peucker algorithm.
 * @param {Array} points - Array of {latitude, longitude} objects.
 * @param {number} epsilon - Tolerance value.
 * @returns {Array} - Simplified path.
 */
function simplifyPath(points, epsilon) {
  // If the path is too short, return it as is.
  if (points.length < 3) return points;

  const sqEpsilon = epsilon * epsilon;

  // Find the point with the maximum distance
  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      index = i;
      maxDist = dist;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > sqEpsilon) {
    const recResults1 = simplifyPath(points.slice(0, index + 1), epsilon);
    const recResults2 = simplifyPath(points.slice(index), epsilon);
    // Combine results, avoid duplicate point at the junction
    return recResults1.slice(0, -1).concat(recResults2);
  } else {
    return [points[0], points[end]];
  }
}

/**
 * Helper function to calculate the squared perpendicular distance
 * from a point to a line segment (start to end).
 */
function perpendicularDistance(point, start, end) {
  const dx = end.latitude - start.latitude;
  const dy = end.longitude - start.longitude;

  if (dx === 0 && dy === 0) {
    return (
      Math.pow(point.latitude - start.latitude, 2) +
      Math.pow(point.longitude - start.longitude, 2)
    );
  }

  const t =
    ((point.latitude - start.latitude) * dx +
      (point.longitude - start.longitude) * dy) /
    (dx * dx + dy * dy);
  const projLat = start.latitude + t * dx;
  const projLng = start.longitude + t * dy;
  const dLat = point.latitude - projLat;
  const dLng = point.longitude - projLng;
  return dLat * dLat + dLng * dLng;
}

/**
 * Samples waypoints from an array to a desired count.
 * @param {Array} waypoints - Array of waypoint objects.
 * @param {number} count - Desired number of waypoints.
 * @returns {Array} - Sampled waypoints.
 */
function sampleWaypoints(waypoints, count) {
  if (waypoints.length <= count) return waypoints;
  const sampled = [];
  const step = (waypoints.length - 1) / (count - 1);
  for (let i = 0; i < count; i++) {
    sampled.push(waypoints[Math.round(i * step)]);
  }
  return sampled;
}
