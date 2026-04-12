/**
 * FlowSphere — Google Maps Service (Singleton)
 * Maps, Directions, Places, Heatmap, Geometry — initialized once, reused everywhere
 */

// Singleton map instances
let mapInstances = {};
let heatmapLayer = null;
let markers = [];
let polylines = [];
let directionsService = null;
let directionsRenderers = [];
let placesService = null;
let mapsLoaded = false;

// Wankhede Stadium, Mumbai coordinates
export const STADIUM_CENTER = { lat: 18.9388, lng: 72.8252 };

// Gate positions around stadium
export const GATES = [
  { id: 'gate-1', name: 'Gate 1 (North)', lat: 18.9400, lng: 72.8252, section: 'North Stand' },
  { id: 'gate-2', name: 'Gate 2 (North-East)', lat: 18.9396, lng: 72.8268, section: 'East Stand' },
  { id: 'gate-3', name: 'Gate 3 (East)', lat: 18.9388, lng: 72.8275, section: 'East Stand' },
  { id: 'gate-4', name: 'Gate 4 (South-East)', lat: 18.9376, lng: 72.8268, section: 'South Stand' },
  { id: 'gate-5', name: 'Gate 5 (South)', lat: 18.9372, lng: 72.8252, section: 'South Stand' },
  { id: 'gate-6', name: 'Gate 6 (West)', lat: 18.9380, lng: 72.8236, section: 'West Stand' }
];

// Concession stall positions
export const CONCESSION_STALLS = [
  { id: 'cs-1', name: 'Chai & Coffee Station A', type: 'beverage', lat: 18.9395, lng: 72.8245, icon: '☕' },
  { id: 'cs-2', name: 'Chai & Coffee Station B', type: 'beverage', lat: 18.9380, lng: 72.8265, icon: '☕' },
  { id: 'cs-3', name: 'Vada Pav Corner', type: 'food', lat: 18.9392, lng: 72.8260, icon: '🍔' },
  { id: 'cs-4', name: 'Biryani Express', type: 'food', lat: 18.9382, lng: 72.8242, icon: '🍛' },
  { id: 'cs-5', name: 'Ice Cream & Kulfi', type: 'dessert', lat: 18.9390, lng: 72.8270, icon: '🍦' },
  { id: 'cs-6', name: 'Fresh Juice Bar', type: 'beverage', lat: 18.9375, lng: 72.8255, icon: '🧃' },
  { id: 'cs-7', name: 'Merchandise Zone', type: 'merchandise', lat: 18.9398, lng: 72.8255, icon: '🏏' },
  { id: 'cs-8', name: 'Snacks & Popcorn', type: 'food', lat: 18.9385, lng: 72.8240, icon: '🍿' }
];

// Get API key from env
const getApiKey = () => {
  try {
    return import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || '';
  } catch {
    return '';
  }
};

/**
 * Load Google Maps Script — only once (singleton)
 */
export const loadGoogleMaps = (apiKey) => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      mapsLoaded = true;
      resolve(window.google.maps);
      return;
    }

    const key = apiKey || getApiKey();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,visualization,geometry,drawing&loading=async&callback=initMapCallback`;
    script.defer = true;
    script.onerror = reject;

    window.initMapCallback = () => {
      mapsLoaded = true;
      directionsService = new window.google.maps.DirectionsService();
      resolve(window.google.maps);
    };

    window.gm_authFailure = () => {
      console.warn("Google Maps auth failed — rendering in dev mode.");
    };

    document.head.appendChild(script);
  });
};

/**
 * Initialize or reuse a Map instance (singleton per element)
 */
export const initMap = (elementId, center = STADIUM_CENTER, zoom = 16, options = {}) => {
  if (!window.google || !window.google.maps) return null;
  const el = document.getElementById(elementId);
  if (!el) return null;

  // Reuse existing instance if available for this element
  if (mapInstances[elementId]) {
    mapInstances[elementId].setCenter(center);
    mapInstances[elementId].setZoom(zoom);
    return mapInstances[elementId];
  }

  const map = new window.google.maps.Map(el, {
    center,
    zoom,
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    scaleControl: true,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: true,
    styles: getMapStyles(),
    ...options
  });

  mapInstances[elementId] = map;
  return map;
};

/**
 * Get or create map instance
 */
export const getMapInstance = (elementId) => mapInstances[elementId] || null;

/**
 * Update heatmap layer
 */
export const updateHeatmap = (heatData, mapElementId = 'venue-map') => {
  const map = mapInstances[mapElementId];
  if (!map || !window.google?.maps?.visualization) return;

  const data = heatData.map(point => ({
    location: new window.google.maps.LatLng(point.lat, point.lng),
    weight: point.weight
  }));

  if (!heatmapLayer) {
    heatmapLayer = new window.google.maps.visualization.HeatmapLayer({
      data,
      radius: 50,
      opacity: 0.7,
      gradient: [
        'rgba(0, 255, 0, 0)',
        'rgba(0, 255, 0, 1)',
        'rgba(255, 255, 0, 1)',
        'rgba(255, 165, 0, 1)',
        'rgba(255, 0, 0, 1)'
      ]
    });
    heatmapLayer.setMap(map);
  } else {
    heatmapLayer.setData(data);
  }
};

/**
 * Create gate markers with InfoWindows
 */
export const updateMarkers = (locations, mapElementId = 'venue-map') => {
  const map = mapInstances[mapElementId];
  if (!map || !window.google) return;

  // Clear old markers
  markers.forEach(m => m.setMap(null));
  markers = [];

  locations.forEach(loc => {
    const waitColor = loc.waitTime < 5 ? '#00e88f' : loc.waitTime < 12 ? '#ffc846' : '#ff4757';
    const statusText = loc.waitTime < 5 ? 'Low Wait' : loc.waitTime < 12 ? 'Moderate' : 'High Wait';

    const marker = new window.google.maps.Marker({
      position: { lat: loc.lat, lng: loc.lng },
      map,
      title: loc.title,
      label: {
        text: loc.icon || '🚪',
        fontSize: '20px'
      },
      optimized: false
    });
    
    // Add aria-label via marker element
    marker.addListener('visible_changed', () => {
      try {
        const markerEl = marker.getElement?.();
        if (markerEl) markerEl.setAttribute('aria-label', `${loc.title}: ${loc.waitTime} minute wait`);
      } catch(e) {}
    });

    const infoContent = `
      <div style="color:#111; padding:8px; font-family:Inter,sans-serif; min-width:200px;">
        <h3 style="margin:0 0 8px; font-size:15px; font-weight:700;">${loc.title}</h3>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${waitColor};"></span>
          <span style="font-size:13px;"><strong>${loc.waitTime} min</strong> wait</span>
        </div>
        <p style="margin:4px 0; font-size:12px; color:#555;">Density: ${loc.density || 'Normal'}</p>
        <p style="margin:4px 0; font-size:12px; color:#555;">Status: <strong>${statusText}</strong></p>
        ${loc.recommendation ? `<p style="margin:8px 0 0; font-size:11px; color:#1a73e8; font-style:italic;">💡 ${loc.recommendation}</p>` : ''}
      </div>
    `;

    const infoWindow = new window.google.maps.InfoWindow({
      content: infoContent,
      ariaLabel: `${loc.title} information`
    });

    marker.addListener("click", () => {
      infoWindow.open({ anchor: marker, map });
    });

    markers.push(marker);
  });
};

/**
 * Draw crowd flow arrows using Polylines
 */
export const drawFlowArrows = (flowPaths, mapElementId = 'venue-map') => {
  const map = mapInstances[mapElementId];
  if (!map || !window.google) return;

  // Clear old polylines
  polylines.forEach(p => p.setMap(null));
  polylines = [];

  flowPaths.forEach(path => {
    const lineSymbol = {
      path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 3,
      strokeColor: path.color || '#00f0ff'
    };

    const polyline = new window.google.maps.Polyline({
      path: path.points.map(p => ({ lat: p.lat, lng: p.lng })),
      icons: [{
        icon: lineSymbol,
        offset: '100%',
        repeat: '60px'
      }],
      strokeColor: path.color || '#00f0ff',
      strokeOpacity: 0.6,
      strokeWeight: 3,
      map
    });

    // Animate the arrows
    let count = 0;
    const animateArrows = () => {
      count = (count + 1) % 200;
      const icons = polyline.get('icons');
      if (icons && icons[0]) {
        icons[0].offset = (count / 2) + '%';
        polyline.set('icons', icons);
      }
    };
    setInterval(animateArrows, 50);

    polylines.push(polyline);
  });
};

/**
 * Render directions between two points
 */
export const renderDirections = async (origin, destination, mapElementId, options = {}) => {
  const map = mapInstances[mapElementId];
  if (!map || !directionsService) return null;

  const renderer = new window.google.maps.DirectionsRenderer({
    map,
    suppressMarkers: options.suppressMarkers || false,
    polylineOptions: {
      strokeColor: options.color || '#00f0ff',
      strokeWeight: 4,
      strokeOpacity: 0.8
    }
  });

  try {
    const result = await directionsService.route({
      origin,
      destination,
      travelMode: options.travelMode || window.google.maps.TravelMode.WALKING
    });

    renderer.setDirections(result);
    directionsRenderers.push(renderer);

    return {
      distance: result.routes[0]?.legs[0]?.distance?.text,
      duration: result.routes[0]?.legs[0]?.duration?.text,
      renderer
    };
  } catch (e) {
    console.error('Directions request failed:', e.message);
    return null;
  }
};

/**
 * Clear all direction renders
 */
export const clearDirections = () => {
  directionsRenderers.forEach(r => r.setMap(null));
  directionsRenderers = [];
};

/**
 * Search nearby places
 */
export const searchNearby = (mapElementId, type = 'restaurant', radius = 500) => {
  const map = mapInstances[mapElementId];
  if (!map || !window.google?.maps?.places) return Promise.resolve([]);

  if (!placesService) {
    placesService = new window.google.maps.places.PlacesService(map);
  }

  return new Promise((resolve) => {
    placesService.nearbySearch(
      { location: STADIUM_CENTER, radius, type },
      (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          resolve(results);
        } else {
          resolve([]);
        }
      }
    );
  });
};

/**
 * Custom map styling for dark theme
 */
function getMapStyles() {
  return [
    { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0c0c1a" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8a8ab0" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a4a" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1a3e" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1a3a" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#16162e" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a2a2a" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1e1e3e" }] }
  ];
}

/**
 * Check if maps are loaded
 */
export const isMapsLoaded = () => mapsLoaded;

/**
 * Generate simulated heatmap data around the stadium
 */
export const generateHeatmapData = (zoneData) => {
  const points = [];
  const zones = zoneData || {};

  // Generate heat points around each gate weighted by density
  GATES.forEach(gate => {
    const zoneKey = Object.keys(zones).find(k => k.toLowerCase().includes(gate.section.toLowerCase().split(' ')[0]));
    const density = zones[zoneKey]?.density || (Math.random() * 4 + 0.5);
    
    for (let i = 0; i < Math.ceil(density * 5); i++) {
      points.push({
        lat: gate.lat + (Math.random() - 0.5) * 0.002,
        lng: gate.lng + (Math.random() - 0.5) * 0.002,
        weight: density
      });
    }
  });

  // Internal stadium area points
  for (let i = 0; i < 30; i++) {
    points.push({
      lat: STADIUM_CENTER.lat + (Math.random() - 0.5) * 0.003,
      lng: STADIUM_CENTER.lng + (Math.random() - 0.5) * 0.003,
      weight: Math.random() * 3 + 1
    });
  }

  return points;
};

/**
 * Generate flow arrow data for crowd movement
 */
export const generateFlowArrows = () => {
  const arrows = [];
  const colors = ['#00f0ff', '#7b61ff', '#00e88f', '#ffc846'];

  for (let i = 0; i < GATES.length - 1; i++) {
    arrows.push({
      points: [
        { lat: GATES[i].lat, lng: GATES[i].lng },
        {
          lat: (GATES[i].lat + STADIUM_CENTER.lat) / 2 + (Math.random() - 0.5) * 0.001,
          lng: (GATES[i].lng + STADIUM_CENTER.lng) / 2 + (Math.random() - 0.5) * 0.001
        },
        STADIUM_CENTER
      ],
      color: colors[i % colors.length]
    });
  }

  return arrows;
};
