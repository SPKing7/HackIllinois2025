// App.js
import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Dimensions,
} from "react-native";
import MapView from "react-native-maps";
import { Polyline, Marker } from "react-native-maps";
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
  const mapRef = useRef(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    })();
  }, []);

  const handleStartDrawing = () => {
    setIsDrawing(true);
    setDrawnPath([]);
    setCalculatedPath([]);
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
      setDrawnPath((prevPath) => [...prevPath, coordinate]);
    }
  };

  const handleMapDrag = (event) => {
    if (isDrawing) {
      const { coordinate } = event.nativeEvent;
      setDrawnPath((prevPath) => [...prevPath, coordinate]);
    }
  };

  const calculatePath = async () => {
    setIsCalculating(true);
    try {
      // This would be replaced with a real API call in a production app
      const walkablePath = await getPathFromPoints(drawnPath);
      setCalculatedPath(walkablePath);
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

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        onPanDrag={handleMapDrag}
        onPress={handleMapPress}
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

      {errorMsg && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  drawButton: {
    backgroundColor: "#4CAF50",
  },
  stopButton: {
    backgroundColor: "#FF9800",
  },
  clearButton: {
    backgroundColor: "#F44336",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
  calculatingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 15,
    alignItems: "center",
  },
  calculatingText: {
    color: "white",
    fontSize: 16,
  },
  errorOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,0,0,0.7)",
    padding: 15,
    alignItems: "center",
  },
  errorText: {
    color: "white",
    fontSize: 16,
  },
});
