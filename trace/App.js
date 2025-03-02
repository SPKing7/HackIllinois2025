import React from "react";
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";

const { height, width } = Dimensions.get("window");

const App = () => {
  //const navigation = useNavigation();

  // Mock data for recent traces
  const recentTraces = [
    { id: "1", name: "Morning Walk", distance: "2.5 km", time: "30 min" },
    { id: "2", name: "Evening Run", distance: "5.0 km", time: "45 min" },
    { id: "3", name: "Park Loop", distance: "3.2 km", time: "25 min" },
  ];

  return (
    <View style={styles.container}>
      {/* Logo Section */}
      <View style={styles.logoContainer}>
        <Image source={require("./assets/logo.png")} style={styles.logo} />
      </View>

      {/* Create New Trace Button Section */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Create New Trace</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Traces List Section */}
      <View style={styles.listContainer}>
        <Text style={styles.heading}>Recent Traces</Text>
        <FlatList
          data={recentTraces}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.traceItem}>
              <Text style={styles.traceName}>{item.name}</Text>
              <Text style={styles.traceDetails}>{item.distance} - {item.time}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  logoContainer: {
    height: height / 2.8,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: height / 10,
  },
  logo: {
    width: 320,
    height: 320,
    resizeMode: "contain",
  },
  buttonContainer: {
    height: height / 4,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    backgroundColor: "#000",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  listContainer: {
    height: height * 5/12,
    paddingHorizontal: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: "600",
    color: "#000",
    marginBottom: 10,
  },
  listContent: {
    alignItems: "center",
  },
  traceItem: {
    backgroundColor: "#f8f8f8",
    padding: 20,
    borderRadius: 10,
    marginBottom: 10,
    width: width - 40,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  traceName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  traceDetails: {
    fontSize: 14,
    color: "#666",
  },
});

export default App;