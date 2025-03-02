// App.js
import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Dimensions,
} from "react-native";
import MapView, { Polyline, Marker } from "react-native-maps";
import * as Location from "expo-location";
import { getPathFromPoints } from "./pathFinder";

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

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        onPanDrag={handleMapDrag}
        onPress={handleMapPress}
        scrollEnabled={!isDrawing} // Disable panning while drawing
        zoomEnabled={!isDrawing} // Disable zooming while drawing
      >
        {drawnPath.length > 0 && (
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
            strokeColor="#00F"
            strokeWidth={5}
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
      </MapView>

      <View style={styles.buttonContainer}>
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

        {calculatedPath.length > 0 && (
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
});
