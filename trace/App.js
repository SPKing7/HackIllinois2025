// App.js
import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Dimensions,
  ScrollView,
  FlatList,
} from "react-native";
import MapView, { Polyline, Marker } from "react-native-maps";
import * as Location from "expo-location";
import { getPathFromPoints, getDirectionsToStart } from "./pathFinder";
import { MaterialIcons } from "@expo/vector-icons";

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
  const [directions, setDirections] = useState([]);
  const [toStartDirections, setToStartDirections] = useState([]);
  const [showDirections, setShowDirections] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [navigating, setNavigating] = useState(false);
  const mapRef = useRef(null);
  const directionsListRef = useRef(null);

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
    if (location && mapRef.current && !isDrawing && !navigating) {
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
  }, [location, isDrawing, navigating]);

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

  // Update directions list scroll when current step changes
  useEffect(() => {
    if (directionsListRef.current && currentStep > 0) {
      directionsListRef.current.scrollToIndex({
        index: currentStep,
        animated: true,
        viewPosition: 0,
      });
    }
  }, [currentStep]);

  const handleStartDrawing = () => {
    setIsDrawing(true);
    setDrawnPath([]);
    setCalculatedPath([]);
    setRouteDistance(null);
    setRouteDuration(null);
    setDirections([]);
    setToStartDirections([]);
    setShowDirections(false);
    setNavigating(false);
    setCurrentStep(0);
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
      const result = await getPathFromPoints(drawnPath);
      setCalculatedPath(result.polyline);
      setRouteDistance(result.distance);
      setRouteDuration(result.duration);
      setDirections(result.directions || []);

      // Also get directions from current location to start point
      if (location && drawnPath.length > 0) {
        const startResult = await getDirectionsToStart(
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          drawnPath[0]
        );
        setToStartDirections(startResult.directions || []);
      }
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
    setDirections([]);
    setToStartDirections([]);
    setShowDirections(false);
    setNavigating(false);
    setCurrentStep(0);
  };

  const toggleOriginalPath = () => {
    setShowOriginalPath(!showOriginalPath);
  };

  const toggleDirections = () => {
    setShowDirections(!showDirections);
  };

  const startNavigation = () => {
    setNavigating(true);
    setCurrentStep(0);
    setShowDirections(true);

    // Zoom to first step
    if (toStartDirections.length > 0) {
      focusOnStep(0, true);
    } else if (directions.length > 0) {
      focusOnStep(0, false);
    }
  };

  const stopNavigation = () => {
    setNavigating(false);
    setCurrentStep(0);
  };

  const nextStep = () => {
    const isInToStartDirections = currentStep < toStartDirections.length;
    const nextStepIndex = currentStep + 1;

    if (isInToStartDirections && nextStepIndex < toStartDirections.length) {
      // Still in to-start directions
      setCurrentStep(nextStepIndex);
      focusOnStep(nextStepIndex, true);
    } else if (
      isInToStartDirections &&
      nextStepIndex >= toStartDirections.length
    ) {
      // Moving from to-start to main directions
      setCurrentStep(nextStepIndex);
      focusOnStep(0, false);
    } else if (nextStepIndex < toStartDirections.length + directions.length) {
      // Moving within main directions
      setCurrentStep(nextStepIndex);
      focusOnStep(nextStepIndex - toStartDirections.length, false);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      const prevStepIndex = currentStep - 1;
      setCurrentStep(prevStepIndex);

      const isInToStartDirections = prevStepIndex < toStartDirections.length;
      if (isInToStartDirections) {
        focusOnStep(prevStepIndex, true);
      } else {
        focusOnStep(prevStepIndex - toStartDirections.length, false);
      }
    }
  };

  const focusOnStep = (stepIndex, isToStart) => {
    if (mapRef.current) {
      const directions = isToStart ? toStartDirections : this.directions;
      if (
        directions &&
        directions[stepIndex] &&
        directions[stepIndex].start_location
      ) {
        const { lat, lng } = directions[stepIndex].start_location;
        mapRef.current.animateToRegion(
          {
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          },
          1000
        );
      }
    }
  };

  const getDirectionIcon = (maneuver) => {
    switch (maneuver) {
      case "turn-right":
        return "turn-right";
      case "turn-left":
        return "turn-left";
      case "turn-slight-right":
        return "turn-slight-right";
      case "turn-slight-left":
        return "turn-slight-left";
      case "turn-sharp-right":
        return "turn-sharp-right";
      case "turn-sharp-left":
        return "turn-sharp-left";
      case "uturn-right":
        return "u-turn";
      case "uturn-left":
        return "u-turn";
      case "roundabout-right":
        return "roundabout-right";
      case "roundabout-left":
        return "roundabout-left";
      case "straight":
        return "arrow-upward";
      default:
        return "directions-walk";
    }
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
    if (meters < 1000) return `${meters} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes} min ${secs} sec`;
  };

  // Combine to-start and main directions
  const allDirections = [...toStartDirections, ...directions];

  const renderDirectionItem = ({ item, index }) => {
    const isActive = index === currentStep;
    const isToStart = index < toStartDirections.length;

    return (
      <TouchableOpacity
        style={[
          styles.directionItem,
          isActive && styles.activeDirectionItem,
          isToStart && styles.toStartDirectionItem,
        ]}
        onPress={() => {
          setCurrentStep(index);
          if (isToStart) {
            focusOnStep(index, true);
          } else {
            focusOnStep(index - toStartDirections.length, false);
          }
        }}
      >
        <View style={styles.directionIconContainer}>
          <MaterialIcons
            name={getDirectionIcon(item.maneuver)}
            size={24}
            color={isActive ? "#147EFB" : "#666"}
          />
        </View>
        <View style={styles.directionTextContainer}>
          <Text
            style={[
              styles.directionText,
              isActive && styles.activeDirectionText,
            ]}
          >
            {item.instruction}
          </Text>
          <Text style={styles.directionDistance}>
            {item.distance && formatDistance(item.distance.value)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        key={mapKey}
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        onPanDrag={handleMapDrag}
        onPress={handleMapPress}
        scrollEnabled={!isDrawing}
        zoomEnabled={!isDrawing}
      >
        {/* Show drawn path based on the toggle state when a calculated route exists */}
        {drawnPath.length > 0 &&
          (showOriginalPath || calculatedPath.length === 0) && (
            <Polyline
              coordinates={drawnPath}
              strokeColor="#F00"
              strokeWidth={3}
              lineDashPattern={[1]}
            />
          )}

        {/* Calculated path */}
        {calculatedPath.length > 0 && (
          <Polyline
            coordinates={calculatedPath}
            strokeColor="#147EFB"
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Start/end markers */}
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

        {/* Add markers for each direction step when navigating */}
        {navigating &&
          allDirections.map((step, index) => {
            if (step.start_location) {
              return (
                <Marker
                  key={`step-${index}`}
                  coordinate={{
                    latitude: step.start_location.lat,
                    longitude: step.start_location.lng,
                  }}
                  opacity={index === currentStep ? 1 : 0.5}
                  pinColor={
                    index < toStartDirections.length ? "blue" : "purple"
                  }
                >
                  <View
                    style={[
                      styles.stepMarker,
                      index === currentStep && styles.activeStepMarker,
                      index < toStartDirections.length &&
                        styles.toStartStepMarker,
                    ]}
                  >
                    <Text style={styles.stepMarkerText}>{index + 1}</Text>
                  </View>
                </Marker>
              );
            }
            return null;
          })}
      </MapView>

      {/* Navigation controls */}
      {navigating && (
        <View style={styles.navigationControls}>
          <TouchableOpacity
            style={styles.navigationButton}
            onPress={prevStep}
            disabled={currentStep === 0}
          >
            <MaterialIcons
              name="arrow-back"
              size={24}
              color={currentStep === 0 ? "#AAA" : "white"}
            />
          </TouchableOpacity>

          <View style={styles.navigationInfo}>
            <Text style={styles.navigationStep}>
              Step {currentStep + 1} of {allDirections.length}
            </Text>
            <Text style={styles.navigationInstruction}>
              {allDirections[currentStep]?.instruction || ""}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.navigationButton}
            onPress={nextStep}
            disabled={currentStep >= allDirections.length - 1}
          >
            <MaterialIcons
              name="arrow-forward"
              size={24}
              color={currentStep >= allDirections.length - 1 ? "#AAA" : "white"}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Directions panel */}
      {showDirections && !isDrawing && (
        <View style={styles.directionsPanel}>
          <View style={styles.directionsPanelHeader}>
            <Text style={styles.directionsPanelTitle}>Directions</Text>
            <TouchableOpacity
              style={styles.directionsCloseButton}
              onPress={toggleDirections}
            >
              <MaterialIcons name="close" size={24} color="black" />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={directionsListRef}
            data={allDirections}
            renderItem={renderDirectionItem}
            keyExtractor={(item, index) => `direction-${index}`}
            style={styles.directionsList}
            initialScrollIndex={0}
            onScrollToIndexFailed={() => {}}
          />
        </View>
      )}

      <View style={styles.buttonContainer}>
        {/* Drawing/finish buttons */}
        {!isDrawing ? (
          <TouchableOpacity
            style={[styles.button, styles.drawButton]}
            onPress={handleStartDrawing}
          >
            <Text style={styles.buttonText}>Draw Route</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={handleStopDrawing}
          >
            <Text style={styles.buttonText}>Finish Drawing</Text>
          </TouchableOpacity>
        )}

        {/* Toggle original path visibility button */}
        {calculatedPath.length > 0 && (
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: showOriginalPath ? "#9C27B0" : "#607D8B" },
            ]}
            onPress={toggleOriginalPath}
          >
            <Text style={styles.buttonText}>
              {showOriginalPath ? "Hide Drawing" : "Show Drawing"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Directions button */}
        {calculatedPath.length > 0 && !isDrawing && !navigating && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#FF9800" }]}
            onPress={toggleDirections}
          >
            <Text style={styles.buttonText}>
              {showDirections ? "Hide Directions" : "Show Directions"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Start/Stop navigation button */}
        {calculatedPath.length > 0 && !isDrawing && (
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: navigating ? "#F44336" : "#4CAF50" },
            ]}
            onPress={navigating ? stopNavigation : startNavigation}
          >
            <Text style={styles.buttonText}>
              {navigating ? "Stop Navigation" : "Start Navigation"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Clear button */}
        {calculatedPath.length > 0 && !navigating && (
          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={clearAll}
          >
            <Text style={styles.buttonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {isCalculating && (
        <View style={styles.calculatingOverlay}>
          <Text style={styles.calculatingText}>Calculating Route...</Text>
        </View>
      )}

      {(routeDistance || routeDuration) && (
        <View style={styles.infoOverlay}>
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
        </View>
      )}

      {errorMsg && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: "100%" },
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
    padding: 15,
    borderRadius: 10,
    margin: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  drawButton: { backgroundColor: "#4CAF50" },
  stopButton: { backgroundColor: "#FF9800" },
  clearButton: { backgroundColor: "#F44336" },
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
  directionsPanel: {
    position: "absolute",
    bottom: 90,
    left: 10,
    right: 10,
    height: "40%",
    backgroundColor: "white",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  directionsPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  directionsPanelTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  directionsCloseButton: {
    padding: 5,
  },
  directionsList: {
    flex: 1,
  },
  directionItem: {
    flexDirection: "row",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  activeDirectionItem: {
    backgroundColor: "#E3F2FD",
  },
  toStartDirectionItem: {
    backgroundColor: "#E8EAF6",
  },
  directionIconContainer: {
    marginRight: 10,
    justifyContent: "center",
  },
  directionTextContainer: {
    flex: 1,
  },
  directionText: {
    fontSize: 14,
  },
  activeDirectionText: {
    fontWeight: "bold",
  },
  directionDistance: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  navigationControls: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
  },
  navigationButton: {
    padding: 10,
  },
  navigationInfo: {
    flex: 1,
    paddingHorizontal: 10,
  },
  navigationStep: {
    color: "white",
    fontSize: 12,
  },
  navigationInstruction: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  stepMarker: {
    backgroundColor: "purple",
    padding: 5,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "white",
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  activeStepMarker: {
    backgroundColor: "#FF9800",
    borderColor: "white",
    transform: [{ scale: 1.2 }],
  },
  toStartStepMarker: {
    backgroundColor: "blue",
  },
  stepMarkerText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
});
