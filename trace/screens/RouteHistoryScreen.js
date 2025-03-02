import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Polyline } from 'react-native-maps';
import { getSavedRoutes, deleteRoute, updateRouteName } from '../utils/routeStorage';

export default function RouteHistoryScreen({ navigation, onSelectRoute }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null);

  useEffect(() => {
    loadRoutes();
  }, []);
  
  const loadRoutes = async () => {
    setLoading(true);
    try {
      const savedRoutes = await getSavedRoutes();
      // Sort by most recent first
      savedRoutes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRoutes(savedRoutes);
    } catch (error) {
      console.error('Failed to load routes:', error);
      Alert.alert('Error', 'Failed to load your saved routes');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoute = async (routeId) => {
    Alert.alert(
      'Delete Route',
      'Are you sure you want to delete this route?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRoute(routeId);
              loadRoutes(); // Refresh the list
            } catch (error) {
              Alert.alert('Error', 'Failed to delete route');
            }
          }
        }
      ]
    );
  };

  const handleEditName = async (routeId, name) => {
    setEditingId(routeId);
    setEditName(name);
  };

  const saveEditedName = async () => {
    if (editingId) {
      try {
        await updateRouteName(editingId, editName);
        loadRoutes(); // Refresh the list
        setEditingId(null);
        setEditName('');
      } catch (error) {
        Alert.alert('Error', 'Failed to update route name');
      }
    }
  };

  const handleSelectRoute = (route) => {
    setSelectedRoute(route.id === selectedRoute?.id ? null : route);
  };

  const handleUseSelectedRoute = () => {
    if (selectedRoute && onSelectRoute) {
      onSelectRoute(selectedRoute);
      navigation.goBack();
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const formatDistance = (meters) => {
    if (!meters) return 'N/A';
    if (meters < 1000) return `${meters} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes} min ${secs} sec`;
  };

  const renderRouteItem = ({ item }) => {
    const isEditing = item.id === editingId;
    const isSelected = item.id === selectedRoute?.id;
    
    return (
      <TouchableOpacity 
        style={[styles.routeItem, isSelected && styles.selectedRouteItem]} 
        onPress={() => handleSelectRoute(item)}
      >
        <View style={styles.routePreviewContainer}>
          <MapView
            style={styles.miniMap}
            zoomEnabled={false}
            scrollEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            initialRegion={getRegionForRoute(item.calculatedPath || item.drawnPath)}
            pointerEvents="none"
          >
            <Polyline
              coordinates={item.calculatedPath || item.drawnPath}
              strokeColor="#147EFB"
              strokeWidth={3}
            />
          </MapView>
        </View>
        
        <View style={styles.routeDetails}>
          {isEditing ? (
            <View style={styles.editNameContainer}>
              <TextInput
                style={styles.editNameInput}
                value={editName}
                onChangeText={setEditName}
                autoFocus
                selectTextOnFocus
              />
              <TouchableOpacity onPress={saveEditedName} style={styles.saveButton}>
                <MaterialIcons name="check" size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingId(null)} style={styles.cancelButton}>
                <MaterialIcons name="close" size={20} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.routeNameRow}>
              <Text style={styles.routeName} numberOfLines={1}>{item.name}</Text>
              <TouchableOpacity onPress={() => handleEditName(item.id, item.name)}>
                <MaterialIcons name="edit" size={18} color="#555" />
              </TouchableOpacity>
            </View>
          )}
          
          <Text style={styles.routeDate}>{formatDate(item.createdAt)}</Text>
          
          <View style={styles.routeStats}>
            <View style={styles.routeStat}>
              <MaterialIcons name="straighten" size={14} color="#555" />
              <Text style={styles.routeStatText}>{formatDistance(item.distance)}</Text>
            </View>
            
            <View style={styles.routeStat}>
              <MaterialIcons name="timer" size={14} color="#555" />
              <Text style={styles.routeStatText}>{formatDuration(item.duration)}</Text>
            </View>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => handleDeleteRoute(item.id)}
        >
          <MaterialIcons name="delete" size={22} color="#D32F2F" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };
  
  // Helper to generate map region from route coordinates
  const getRegionForRoute = (coordinates) => {
    if (!coordinates || coordinates.length === 0) {
      return {
        latitude: 0,
        longitude: 0,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      };
    }
    
    // Calculate the bounding box for the coordinates
    let minLat = coordinates[0].latitude;
    let maxLat = coordinates[0].latitude;
    let minLng = coordinates[0].longitude;
    let maxLng = coordinates[0].longitude;
    
    coordinates.forEach(coord => {
      minLat = Math.min(minLat, coord.latitude);
      maxLat = Math.max(maxLat, coord.latitude);
      minLng = Math.min(minLng, coord.longitude);
      maxLng = Math.max(maxLng, coord.longitude);
    });
    
    // Add padding
    const latDelta = (maxLat - minLat) * 1.5 || 0.01;
    const lngDelta = (maxLng - minLng) * 1.5 || 0.01;
    
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#147EFB" />
        </TouchableOpacity>
        <Text style={styles.title}>Saved Routes</Text>
        <View style={{width: 24}} /* Spacer for alignment */ />
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#147EFB" />
          <Text style={styles.loadingText}>Loading your routes...</Text>
        </View>
      ) : routes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="route" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No saved routes yet</Text>
          <Text style={styles.emptySubtext}>Your saved routes will appear here</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={routes}
            renderItem={renderRouteItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
          />
          
          {selectedRoute && onSelectRoute && (
            <TouchableOpacity 
              style={styles.useRouteButton}
              onPress={handleUseSelectedRoute}
            >
              <Text style={styles.useRouteText}>Use Selected Route</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  list: {
    padding: 16,
  },
  routeItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  selectedRouteItem: {
    borderWidth: 2,
    borderColor: '#147EFB',
  },
  routePreviewContainer: {
    width: 100,
    height: 100,
  },
  miniMap: {
    width: '100%',
    height: '100%',
  },
  routeDetails: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  routeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 24, // Make space for delete button
  },
  routeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  routeDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  routeStats: {
    flexDirection: 'row',
    marginTop: 8,
  },
  routeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  routeStatText: {
    fontSize: 12,
    color: '#555',
    marginLeft: 4,
  },
  deleteButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editNameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 16,
  },
  saveButton: {
    padding: 6,
    backgroundColor: '#4CAF50',
    borderRadius: 4,
    marginLeft: 8,
  },
  cancelButton: {
    padding: 6,
    backgroundColor: '#F44336',
    borderRadius: 4,
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  useRouteButton: {
    backgroundColor: '#147EFB',
    margin: 16,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  useRouteText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
