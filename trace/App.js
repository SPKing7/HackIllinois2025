// App.js
import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Dimensions,
  Image,
  SafeAreaView,
  Platform,
  StatusBar,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import MapView, { Polyline, Marker } from "react-native-maps";
import * as Location from "expo-location";
import { getPathFromPoints } from "./pathFinder";
import { MaterialIcons } from "@expo/vector-icons";
import RouteHistoryScreen from "./screens/RouteHistoryScreen";
import { saveRoute } from "./utils/routeStorage";

const { width, height } = Dimensions.get("window");

export default function App() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnPath, setDrawnPath] = useState([]);
  const [calculatedPath, setCalculatedPath] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeDistance, setRouteDistance] = useState(null);
  const [routeDuration, setRouteDuration] = useState(null);
  const [showOriginalPath, setShowOriginalPath] = useState(false); // New state for original path visibility toggle
  const [mapKey, setMapKey] = useState(1); // Add state to force map re-rendering
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [remainingDistance, setRemainingDistance] = useState(null);
  const [eta, setEta] = useState(null);
  const [navigationSteps, setNavigationSteps] = useState([]);
  const [userLocationSubscription, setUserLocationSubscription] =
    useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [showHistoryScreen, setShowHistoryScreen] = useState(false);
  const mapRef = useRef(null);

  // Request location permission and get current location
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        return;
      }
      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    })();
  }, []);

  // Animate to current location ONLY when not drawing
  useEffect(() => {
    if (location && mapRef.current && !isDrawing) {
      mapRef.current.animateToRegion(
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        },
        1000 // 1-second animation
      );
    }
  }, [location, isDrawing]);

  // Add new useEffect to handle calculated path updates
  useEffect(() => {
    if (calculatedPath.length > 0) {
      // Force map to re-render when path is calculated
      setMapKey((prevKey) => prevKey + 1);

      // Optional: fit the map to show the entire route
      if (mapRef.current && calculatedPath.length > 0) {
        setTimeout(() => {
          mapRef.current.fitToCoordinates(calculatedPath, {
            edgePadding: { top: 50, right: 50, bottom: 150, left: 50 },
            animated: true,
          });
        }, 500); // Short delay to ensure the map has time to re-render
      }
    }
  }, [calculatedPath]);

  // Initialize navigation steps when route is calculated
  useEffect(() => {
    if (calculatedPath.length > 0) {
      // Generate navigation steps from the calculated path
      const steps = generateNavigationSteps(calculatedPath);
      setNavigationSteps(steps);
    }
  }, [calculatedPath]);

  // Active navigation tracking
  useEffect(() => {
    // Only activate location tracking when in navigation mode
    if (isNavigating) {
      // Start watching position with higher accuracy when navigating
      const startLocationTracking = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setErrorMsg(
            "Permission to access location was denied for navigation"
          );
          return;
        }

        // Watch position with high accuracy when navigating
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 5, // Update every 5 meters
            timeInterval: 1000, // Or at least once per second
          },
          (location) => {
            // Update user location
            setLocation(location);

            // Update navigation progress
            updateNavigationProgress(location.coords);
          }
        );

        setUserLocationSubscription(subscription);
      };

      startLocationTracking();

      // Clean up the subscription when navigation ends
      return () => {
        if (userLocationSubscription) {
          userLocationSubscription.remove();
        }
      };
    }
  }, [isNavigating]);

  const handleStartDrawing = () => {
    setIsDrawing(true);
    setDrawnPath([]);
    setCalculatedPath([]);
    setRouteDistance(null);
    setRouteDuration(null);
  };

  const handleStopDrawing = () => {
    setIsDrawing(false);
    if (drawnPath.length > 1) {
      calculatePath();
    }
  };

  const handleMapPress = (event) => {
    if (isDrawing) {
      const { coordinate } = event.nativeEvent;
      setDrawnPath((prev) => [...prev, coordinate]);
    }
  };

  const handleMapDrag = (event) => {
    if (isDrawing) {
      const { coordinate } = event.nativeEvent;
      setDrawnPath((prev) => [...prev, coordinate]);
    }
  };

  const calculatePath = async () => {
    setIsCalculating(true);
    try {
      // Call our directions function which uses the Google Directions API.
      // The drawn path is resampled every ~25 feet and simplified.
      const result = await getPathFromPoints(drawnPath);
      setCalculatedPath(result.polyline);
      setRouteDistance(result.distance);
      setRouteDuration(result.duration);
    } catch (error) {
      console.error("Error calculating path:", error);
      setErrorMsg("Failed to calculate a walkable path");
    } finally {
      setIsCalculating(false);
    }
  };

  const clearAll = () => {
    setDrawnPath([]);
    setCalculatedPath([]);
    setRouteDistance(null);
    setRouteDuration(null);
  };

  const toggleOriginalPath = () => {
    setShowOriginalPath(!showOriginalPath);
  };

  const initialRegion = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }
    : {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };

  // Helpers to format distance and duration
  const formatDistance = (meters) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${Math.round(meters / 1000)} km`;
  };

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes} min ${secs} sec`;
  };

  // Generate turn-by-turn directions from the route
  const generateNavigationSteps = (routePath) => {
    if (!routePath || routePath.length < 2) return [];

    const steps = [];

    // For simplicity, we'll create steps at key points
    // In a real app, you'd use the leg/step data from the directions API
    for (
      let i = 0;
      i < routePath.length - 1;
      i += Math.max(1, Math.floor(routePath.length / 10))
    ) {
      const current = routePath[i];
      const next =
        routePath[
          Math.min(i + Math.floor(routePath.length / 10), routePath.length - 1)
        ];

      // Calculate bearing to determine direction
      const bearing = calculateBearing(current, next);
      const direction = getDirectionFromBearing(bearing);

      steps.push({
        point: current,
        nextPoint: next,
        instruction: `Go ${direction}`,
        distance: getDistanceMeters(current, next),
        bearing: bearing,
      });
    }

    // Add final step
    steps.push({
      point: routePath[routePath.length - 1],
      instruction: "Arrive at destination",
      distance: 0,
      isLast: true,
    });

    return steps;
  };

  // Update navigation progress based on user's current location
  const updateNavigationProgress = (userCoords) => {
    if (!navigationSteps || navigationSteps.length === 0) return;

    // Find which step the user is closest to
    const userPoint = {
      latitude: userCoords.latitude,
      longitude: userCoords.longitude,
    };

    // Find closest point on route
    let minDistance = Infinity;
    let closestStepIndex = 0;

    navigationSteps.forEach((step, index) => {
      if (index >= currentStep) {
        // Only look at steps ahead
        const distance = getDistanceMeters(userPoint, step.point);
        if (distance < minDistance) {
          minDistance = distance;
          closestStepIndex = index;
        }
      }
    });

    // If user is close to next step, advance
    if (closestStepIndex > currentStep) {
      setCurrentStep(closestStepIndex);
    }

    // Calculate remaining distance
    let remaining = 0;
    for (let i = closestStepIndex; i < navigationSteps.length - 1; i++) {
      remaining += navigationSteps[i].distance || 0;
    }
    setRemainingDistance(remaining);

    // Calculate ETA (assuming average walking speed of 1.4 m/s)
    const walkingSpeed = 1.4; // meters per second
    const estimatedSeconds = remaining / walkingSpeed;
    setEta(new Date(Date.now() + estimatedSeconds * 1000));
  };

  // Helper functions for navigation
  const calculateBearing = (start, end) => {
    const startLat = toRad(start.latitude);
    const startLng = toRad(start.longitude);
    const endLat = toRad(end.latitude);
    const endLng = toRad(end.longitude);

    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x =
      Math.cos(startLat) * Math.sin(endLat) -
      Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);

    let bearing = Math.atan2(y, x);
    bearing = toDeg(bearing);
    bearing = (bearing + 360) % 360;

    return bearing;
  };

  const getDirectionFromBearing = (bearing) => {
    const directions = [
      "north",
      "northeast",
      "east",
      "southeast",
      "south",
      "southwest",
      "west",
      "northwest",
      "north",
    ];
    return directions[Math.round(bearing / 45)];
  };

  const toRad = (deg) => {
    return (deg * Math.PI) / 180;
  };

  const toDeg = (rad) => {
    return (rad * 180) / Math.PI;
  };

  const getDistanceMeters = (p1, p2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = toRad(p2.latitude - p1.latitude);
    const dLon = toRad(p2.longitude - p1.longitude);
    const lat1 = toRad(p1.latitude);
    const lat2 = toRad(p2.latitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Start turn-by-turn navigation
  const startNavigation = () => {
    setIsNavigating(true);
    setCurrentStep(0);

    // Zoom to user's current location with route visible
    if (mapRef.current && location) {
      setTimeout(() => {
        mapRef.current.animateCamera(
          {
            center: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            },
            pitch: 60, // Tilt the map for a 3D navigation feel
            heading: 0, // North-up initially
            altitude: 500, // Higher altitude for better context
            zoom: 18, // Close zoom for navigation
          },
          { duration: 1000 }
        );
      }, 500);
    }
  };

  // Stop navigation and return to normal map view
  const stopNavigation = () => {
    setIsNavigating(false);

    // Reset map view
    if (mapRef.current && calculatedPath.length > 0) {
      setTimeout(() => {
        mapRef.current.fitToCoordinates(calculatedPath, {
          edgePadding: { top: 50, right: 50, bottom: 150, left: 50 },
          animated: true,
        });
      }, 500);
    }

    // Clean up navigation state
    if (userLocationSubscription) {
      userLocationSubscription.remove();
      setUserLocationSubscription(null);
    }
  };

  // Format ETA time
  const formatETA = (eta) => {
    if (!eta) return "--:--";
    const hours = eta.getHours();
    const minutes = eta.getMinutes();
    return `${hours}:${minutes < 10 ? "0" : ""}${minutes}`;
  };

  // Function to handle saving the current route
  const handleSaveRoute = async () => {
    if (calculatedPath.length === 0) {
      Alert.alert("Error", "No route to save");
      return;
    }

    setShowSaveModal(true);
    setRouteName(`Route ${new Date().toLocaleDateString()}`);
  };

  // Function to save route with entered name
  const saveCurrentRoute = async () => {
    if (!routeName.trim()) {
      Alert.alert("Error", "Please enter a route name");
      return;
    }

    try {
      await saveRoute({
        name: routeName,
        drawnPath,
        calculatedPath,
        distance: routeDistance,
        duration: routeDuration,
      });

      setShowSaveModal(false);
      Alert.alert("Success", "Route saved successfully");
    } catch (error) {
      console.error("Error saving route:", error);
      Alert.alert("Error", "Failed to save route");
    }
  };

  // Function to load a saved route
  const loadSavedRoute = (route) => {
    setDrawnPath(route.drawnPath || []);
    setCalculatedPath(route.calculatedPath || []);
    setRouteDistance(route.distance);
    setRouteDuration(route.duration);

    // Fit map to the loaded route
    if (mapRef.current && route.calculatedPath?.length > 0) {
      setTimeout(() => {
        mapRef.current.fitToCoordinates(route.calculatedPath, {
          edgePadding: { top: 50, right: 50, bottom: 150, left: 50 },
          animated: true,
        });
      }, 500);
    }
  };

  // If showing history screen, render that instead of main app
  if (showHistoryScreen) {
    return (
      <RouteHistoryScreen
        navigation={{
          goBack: () => setShowHistoryScreen(false),
        }}
        onSelectRoute={loadSavedRoute}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isNavigating ? "light-content" : "dark-content"} />
      <MapView
        key={mapKey} // Add key prop to force re-render when it changes
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        followsUserLocation={isNavigating}
        showsCompass={isNavigating}
        scrollEnabled={!isDrawing} // Disable panning while drawing
        zoomEnabled={!isDrawing} // Disable zooming while drawing
        rotateEnabled={isNavigating}
        pitchEnabled={isNavigating}
        onPanDrag={isDrawing ? handleMapDrag : null}
        onPress={isDrawing ? handleMapPress : null}
        mapPadding={
          isNavigating ? { top: 0, right: 0, bottom: 200, left: 0 } : null
        }
      >
        {/* Show drawn path based on the toggle state when a calculated route exists */}
        {drawnPath.length > 0 &&
          !isNavigating &&
          (showOriginalPath || calculatedPath.length === 0) && (
            <Polyline
              coordinates={drawnPath}
              strokeColor="#F00"
              strokeWidth={3}
              lineDashPattern={[1]}
            />
          )}

        {/* Calculated path and markers... */}
        {calculatedPath.length > 0 && (
          <Polyline
            coordinates={calculatedPath}
            strokeColor="#147EFB"
            strokeWidth={isNavigating ? 8 : 6}
            lineCap="round"
            lineJoin="round"
            zIndex={1}
          />
        )}

        {/* Keep the start/end markers visible regardless */}
        {drawnPath.length > 0 && (
          <Marker coordinate={drawnPath[0]} pinColor="green" title="Start" />
        )}
        {drawnPath.length > 1 && (
          <Marker
            coordinate={drawnPath[drawnPath.length - 1]}
            pinColor="red"
            title="End"
          />
        )}

        {/* Current navigation step marker */}
        {isNavigating && navigationSteps.length > currentStep && (
          <Marker
            coordinate={navigationSteps[currentStep].point}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.nextStepMarker}>
              <MaterialIcons name="directions" size={20} color="white" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Navigation overlay - shown only when navigating */}
      {isNavigating && navigationSteps.length > currentStep && (
        <View style={styles.navigationOverlay}>
          {/* Top bar with current instruction */}
          <View style={styles.navigationHeader}>
            <View style={styles.directionContainer}>
              <MaterialIcons
                name={getNavigationIcon(
                  navigationSteps[currentStep].instruction
                )}
                size={36}
                color="white"
              />
              <Text style={styles.directionText}>
                {navigationSteps[currentStep].instruction}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.exitNavButton}
              onPress={stopNavigation}
            >
              <MaterialIcons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Bottom information card */}
          <View style={styles.navigationInfo}>
            <View style={styles.navigationDetail}>
              <Text style={styles.distanceText}>
                {remainingDistance
                  ? formatDistance(remainingDistance)
                  : "Calculating..."}
              </Text>
              <Text style={styles.etaText}>
                ETA {eta ? formatETA(eta) : "--:--"}
              </Text>
            </View>

            {/* Next step preview */}
            {currentStep < navigationSteps.length - 1 && (
              <View style={styles.nextDirectionContainer}>
                <Text style={styles.nextLabel}>NEXT</Text>
                <Text style={styles.nextDirectionText}>
                  {navigationSteps[currentStep + 1].instruction}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Show normal UI when not navigating */}
      {!isNavigating && (
        <View style={styles.buttonContainer}>
          {/* Drawing/finish buttons */}
          {!isDrawing ? (
            calculatedPath.length === 0 ? (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.drawButton]}
                  onPress={handleStartDrawing}
                >
                  <Text style={styles.buttonText}>Draw Route</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button]}
                  onPress={() => setShowHistoryScreen(true)}
                >
                  <Text style={styles.buttonText}>View History</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Navigation button when there's a route */}
                <TouchableOpacity
                  style={[styles.button]}
                  onPress={startNavigation}
                >
                  <Text style={styles.buttonText}>Start Navigation</Text>
                </TouchableOpacity>

                {/* Save route button */}
                <TouchableOpacity
                  style={[styles.button]}
                  onPress={handleSaveRoute}
                >
                  <Text style={styles.buttonText}>Save Route</Text>
                </TouchableOpacity>
              </>
            )
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.stopButton]}
              onPress={handleStopDrawing}
            >
              <Text style={styles.buttonText}>Finish Drawing</Text>
            </TouchableOpacity>
          )}

          {/* Toggle original path visibility button - only show when we have a calculated route */}
          {calculatedPath.length > 0 && (
            <TouchableOpacity
              style={[
                styles.button
              ]}
              onPress={toggleOriginalPath}
            >
              <Text style={styles.buttonText}>
                {showOriginalPath ? "Hide Drawing" : "Show Drawing"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Clear button */}
          {calculatedPath.length > 0 && (
            <TouchableOpacity
              style={[styles.button, styles.clearButton]}
              onPress={clearAll}
            >
              <Text style={styles.buttonText}>Clear All</Text>
            </TouchableOpacity>
          )}

          {calculatedPath.length > 0 && (
            <TouchableOpacity
              style={[styles.button]}
              onPress={() => setShowHistoryScreen(true)}
            >
              <Text style={styles.buttonText}>View History</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isCalculating && (
        <View style={styles.calculatingOverlay}>
          <Text style={styles.calculatingText}>Calculating Route...</Text>
        </View>
      )}

      {(routeDistance || routeDuration || remainingDistance !== null) && (
        <View style={styles.infoOverlay}>
          {remainingDistance !== null ? (
            <>
              <Text style={styles.infoText}>
                Distance: {formatDistance(remainingDistance)}
              </Text>
              <Text style={styles.infoText}>
                ETA: {eta ? formatETA(eta) : "--:--"}
              </Text>
            </>
          ) : (
            <>
              {routeDistance && (
                <Text style={styles.infoText}>
                  Distance: {formatDistance(routeDistance)}
                </Text>
              )}
              {routeDuration && (
                <Text style={styles.infoText}>
                  Duration: {formatDuration(routeDuration)}
                </Text>
              )}
            </>
          )}
        </View>
      )}

      {errorMsg && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* Save Route Modal */}
      <Modal
        visible={showSaveModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Route</Text>

            <TextInput
              style={styles.nameInput}
              value={routeName}
              onChangeText={setRouteName}
              placeholder="Enter a name for this route"
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowSaveModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveModalButton]}
                onPress={saveCurrentRoute}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Helper function to get icon based on instruction
const getNavigationIcon = (instruction) => {
  if (instruction.includes("north")) return "arrow-upward";
  if (instruction.includes("northeast")) return "north-east";
  if (instruction.includes("east")) return "arrow-forward";
  if (instruction.includes("southeast")) return "south-east";
  if (instruction.includes("south")) return "arrow-downward";
  if (instruction.includes("southwest")) return "south-west";
  if (instruction.includes("west")) return "arrow-back";
  if (instruction.includes("northwest")) return "north-west";
  if (instruction.includes("Arrive")) return "place";
  return "directions";
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  buttonContainer: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    maxWidth: "90%",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    margin: 8,
    backgroundColor: "#147EFB", // uniform blue color
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  buttonText: { color: "white", fontWeight: "bold", textAlign: "center" },
  calculatingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 15,
    alignItems: "center",
  },
  calculatingText: { color: "white", fontSize: 16 },
  errorOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,0,0,0.7)",
    padding: 15,
    alignItems: "center",
  },
  errorText: { color: "white", fontSize: 16 },
  infoOverlay: {
    position: "absolute",
    top: 50,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 8,
  },
  infoText: { color: "white", fontSize: 14, marginVertical: 2 },
  // Navigation mode styles
  navigationOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  navigationHeader: {
    flexDirection: "row",
    backgroundColor: "#147EFB",
    padding: 15,
    alignItems: "center",
    justifyContent: "space-between",
    margin: 10,
    borderRadius: 12,
  },
  directionContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  directionText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 10,
  },
  navigationInfo: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  navigationDetail: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  distanceText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  etaText: {
    fontSize: 16,
    color: "#666",
  },
  nextDirectionContainer: {
    borderTopWidth: 1,
    borderColor: "#eee",
    paddingTop: 10,
  },
  nextLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 5,
  },
  nextDirectionText: {
    fontSize: 14,
    color: "#333",
  },
  nextStepMarker: {
    backgroundColor: "#147EFB",
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: "white",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    width: "100%",
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    width: "48%",
    alignItems: "center",
  },
  modalButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});
