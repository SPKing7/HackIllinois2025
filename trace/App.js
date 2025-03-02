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
import {calculateBearing, getDirectionFromBearing, getDistanceMeters} from './utils/navigationUtils';

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
  const [showOriginalPath, setShowOriginalPath] = useState(false); 
  const [mapKey, setMapKey] = useState(1); 
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

  useEffect(() => {
    if (location && mapRef.current && !isDrawing) {
      mapRef.current.animateToRegion(
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        },
        1000 
      );
    }
  }, [location, isDrawing]);

  // Add new useEffect to handle calculated path updates
  useEffect(() => {
    if (calculatedPath.length > 0) {
      setMapKey((prevKey) => prevKey + 1);

      if (mapRef.current && calculatedPath.length > 0) {
        setTimeout(() => {
          mapRef.current.fitToCoordinates(calculatedPath, {
            edgePadding: { top: 50, right: 50, bottom: 150, left: 50 },
            animated: true,
          });
        }, 500); 
      }
    }
  }, [calculatedPath]);

  // Initialize navigation steps when route is calculated
  useEffect(() => {
    if (calculatedPath.length > 0) {
      const steps = generateNavigationSteps(calculatedPath);
      setNavigationSteps(steps);
    }
  }, [calculatedPath]);

  // Active navigation tracking
  useEffect(() => {
    if (isNavigating) {
      const startLocationTracking = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setErrorMsg(
            "Permission to access location was denied for navigation"
          );
          return;
        }

        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 5, 
            timeInterval: 1000,
          },
          (location) => {
            setLocation(location);

            updateNavigationProgress(location.coords);
          }
        );

        setUserLocationSubscription(subscription);
      };

      startLocationTracking();

      return () => {
        if (userLocationSubscription) {
          userLocationSubscription.remove();
        }
      };
    }
  }, [isNavigating]);

  // Handle start and stop drawing
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

  // Calculate the path
  const calculatePath = async () => {
    setIsCalculating(true);
    try {
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

  // Toggle the visibility of the original path
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

    const userPoint = {
      latitude: userCoords.latitude,
      longitude: userCoords.longitude,
    };

    let minDistance = Infinity;
    let closestStepIndex = 0;

    navigationSteps.forEach((step, index) => {
      if (index >= currentStep) {
        const distance = getDistanceMeters(userPoint, step.point);
        if (distance < minDistance) {
          minDistance = distance;
          closestStepIndex = index;
        }
      }
    });

    if (closestStepIndex > currentStep) {
      setCurrentStep(closestStepIndex);
    }

    let remaining = 0;
    for (let i = closestStepIndex; i < navigationSteps.length - 1; i++) {
      remaining += navigationSteps[i].distance || 0;
    }
    setRemainingDistance(remaining);

    const walkingSpeed = 1.4; 
    const estimatedSeconds = remaining / walkingSpeed;
    setEta(new Date(Date.now() + estimatedSeconds * 1000));
  };

  // Helper functions for navigation
  
  // Start turn-by-turn navigation
  const startNavigation = () => {
    setIsNavigating(true);
    setCurrentStep(0);

    if (mapRef.current && location) {
      setTimeout(() => {
        mapRef.current.animateCamera(
          {
            center: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            },
            pitch: 60,
            heading: 0,
            altitude: 500, 
            zoom: 18,
          },
          { duration: 1000 }
        );
      }, 500);
    }
  };

  // Stop navigation and return to normal map view
  const stopNavigation = () => {
    setIsNavigating(false);

    if (mapRef.current && calculatedPath.length > 0) {
      setTimeout(() => {
        mapRef.current.fitToCoordinates(calculatedPath, {
          edgePadding: { top: 50, right: 50, bottom: 150, left: 50 },
          animated: true,
        });
      }, 500);
    }

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
      const savedRouteId = await saveRoute({
        name: routeName,
        drawnPath,
        calculatedPath,
        distance: routeDistance,
        duration: routeDuration,
      });
      
      setShowSaveModal(false);
      setRouteName(''); 
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

    if (mapRef.current && route.calculatedPath?.length > 0) {
      setTimeout(() => {
        mapRef.current.fitToCoordinates(route.calculatedPath, {
          edgePadding: { top: 50, right: 50, bottom: 150, left: 50 },
          animated: true,
        });
      }, 500);
    }
  };

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
        key={mapKey}
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        followsUserLocation={isNavigating}
        showsCompass={isNavigating}
        scrollEnabled={!isDrawing} 
        zoomEnabled={!isDrawing} 
        rotateEnabled={isNavigating}
        pitchEnabled={isNavigating}
        onPanDrag={isDrawing ? handleMapDrag : null}
        onPress={isDrawing ? handleMapPress : null}
        mapPadding={
          isNavigating ? { top: 0, right: 0, bottom: 200, left: 0 } : null
        }
      >
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

      {isNavigating && navigationSteps.length > currentStep && (
        <View style={styles.navigationOverlay}>
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

      {!isNavigating && (
        <View style={styles.buttonContainer}>
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
                <TouchableOpacity
                  style={[styles.button]}
                  onPress={startNavigation}
                >
                  <Text style={styles.buttonText}>Start Navigation</Text>
                </TouchableOpacity>

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

                {calculatedPath.length > 0 && (
                <TouchableOpacity
                  style={[styles.button, styles.clearButton, { backgroundColor: 'red' }]}
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
              onChangeText={(text) => setRouteName(text)}
              placeholder="Enter a name for this route"
              autoFocus
              returnKeyType="done"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: '#ccc' }]}
                onPress={() => {
                  setShowSaveModal(false);
                  setRouteName(''); 
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: '#4CAF50' }]}
                onPress={saveCurrentRoute}
                accessibilityLabel="Save route"
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
    backgroundColor: "#147EFB", 
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
  saveModalButton: {
    backgroundColor: "#4CAF50",
  },
  cancelButton: {
    backgroundColor: "#ccc",
  },
  modalButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});
