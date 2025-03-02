import React from "react";
import { View, Text, Button, FlatList, Image, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";

const Home = () => {
  const navigation = useNavigation();

  // Mock data for recent traces
  const recentTraces = [
    { id: "1", name: "Morning Walk", distance: "2.5 km", time: "30 min" },
    { id: "2", name: "Evening Run", distance: "5.0 km", time: "45 min" },
    { id: "3", name: "Park Loop", distance: "3.2 km", time: "25 min" },
  ];

  return (
    <View style={styles.container}>
      {/* Logo Placeholder */}
      <Image source={require("./assets/logo.svg")} style={styles.logo} />

      {/* Create New Trace Button */}
      <Button title="Create New Trace" onPress={() => navigation.navigate("Trace")} />

      {/* Recent Traces List */}
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
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  heading: {
    fontSize: 20,
    fontWeight: "bold",
    marginVertical: 10,
  },
  traceItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    width: "100%",
    alignItems: "center",
  },
  traceName: {
    fontSize: 18,
    fontWeight: "bold",
  },
  traceDetails: {
    fontSize: 14,
    color: "gray",
  },
});

export default Home;
