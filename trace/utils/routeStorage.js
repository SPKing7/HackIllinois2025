import AsyncStorage from '@react-native-async-storage/async-storage';

const ROUTES_STORAGE_KEY = '@trace_saved_routes';

/**
 * Save a new route to AsyncStorage
 * @param {Object} route - The route object containing drawn path, calculated path, etc.
 * @returns {Promise<string>} - The ID of the saved route
 */
export const saveRoute = async (route) => {
  try {
    // Get existing routes
    const existingRoutes = await getSavedRoutes();
    
    // Create new route object with metadata
    const newRoute = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      name: route.name || `Route ${existingRoutes.length + 1}`,
      drawnPath: route.drawnPath,
      calculatedPath: route.calculatedPath,
      distance: route.distance,
      duration: route.duration,
    };
    
    // Add to existing routes
    const updatedRoutes = [...existingRoutes, newRoute];
    
    // Save to storage
    await AsyncStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(updatedRoutes));
    
    return newRoute.id;
  } catch (error) {
    console.error('Error saving route:', error);
    throw error;
  }
};

/**
 * Get all saved routes from AsyncStorage
 * @returns {Promise<Array>} - Array of saved route objects
 */
export const getSavedRoutes = async () => {
  try {
    const routesJSON = await AsyncStorage.getItem(ROUTES_STORAGE_KEY);
    return routesJSON ? JSON.parse(routesJSON) : [];
  } catch (error) {
    console.error('Error getting saved routes:', error);
    return [];
  }
};

/**
 * Get a specific route by ID
 * @param {string} routeId - The ID of the route to get
 * @returns {Promise<Object|null>} - The route object or null if not found
 */
export const getRouteById = async (routeId) => {
  try {
    const routes = await getSavedRoutes();
    return routes.find(route => route.id === routeId) || null;
  } catch (error) {
    console.error('Error getting route by ID:', error);
    return null;
  }
};

/**
 * Delete a route by ID
 * @param {string} routeId - The ID of the route to delete
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export const deleteRoute = async (routeId) => {
  try {
    const routes = await getSavedRoutes();
    const updatedRoutes = routes.filter(route => route.id !== routeId);
    await AsyncStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(updatedRoutes));
    return true;
  } catch (error) {
    console.error('Error deleting route:', error);
    return false;
  }
};

/**
 * Update a route's name
 * @param {string} routeId - The ID of the route to update
 * @param {string} newName - The new name for the route
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export const updateRouteName = async (routeId, newName) => {
  try {
    const routes = await getSavedRoutes();
    const updatedRoutes = routes.map(route => 
      route.id === routeId ? { ...route, name: newName } : route
    );
    await AsyncStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(updatedRoutes));
    return true;
  } catch (error) {
    console.error('Error updating route name:', error);
    return false;
  }
};

// Helper function to generate a unique ID
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};
