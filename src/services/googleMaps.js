/**
 * Google Maps Integration Service
 */

let mapInstance = null;
let heatmapLayer = null;
let markers = [];
const MAP_ID = 'venue-map';

// Load Google Maps Script lazily
export const loadGoogleMaps = (apiKey) => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve(window.google.maps);
      return;
    }
    const script = document.createElement('script');
    // Using weekly version and loading visualization library for heatmap
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,visualization&loading=async&callback=initMapCallback`;
    script.defer = true;
    script.onerror = reject;
    
    window.initMapCallback = () => {
      resolve(window.google.maps);
    };

    window.gm_authFailure = () => {
      console.warn("Google maps auth failed, rendering without key.");
      // Prevents gray box from replacing everything, although watermark will persist
    };
    
    document.head.appendChild(script);
  });
};

/**
 * Initialize Map
 */
export const initMap = (elementId = MAP_ID, center = { lat: 40.7128, lng: -74.0060 }) => {
  if (!window.google || !window.google.maps) return;
  const mapElement = document.getElementById(elementId);
  if (!mapElement) return;

  mapInstance = new window.google.maps.Map(mapElement, {
    center,
    zoom: 16,
    disableDefaultUI: true,
    zoomControl: true,
  });

  return mapInstance;
};

/**
 * Render Heatmap for crowd density
 * @param {Array<{location: object, weight: number}>} heatData
 */
export const updateHeatmap = (heatData) => {
  if (!mapInstance || !window.google || !window.google.maps.visualization) return;

  const data = heatData.map(point => ({
    location: new window.google.maps.LatLng(point.lat, point.lng),
    weight: point.weight
  }));

  if (!heatmapLayer) {
    heatmapLayer = new window.google.maps.visualization.HeatmapLayer({
      data: data,
      radius: 40,
      opacity: 0.6
    });
    heatmapLayer.setMap(mapInstance);
  } else {
    heatmapLayer.setData(data);
  }
};

/**
 * Render InfoWindow Markers (e.g. Gates, Facilities)
 */
export const updateMarkers = (locations) => {
  if (!mapInstance || !window.google) return;

  // Clear old
  markers.forEach(m => m.setMap(null));
  markers = [];

  locations.forEach(loc => {
    const marker = new window.google.maps.Marker({
      position: { lat: loc.lat, lng: loc.lng },
      map: mapInstance,
      title: loc.title,
      // optimized: false is often used to prevent some rendering issues in dev
      optimized: false
    });
    
    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="color: #000; padding: 5px;">
          <h3 style="margin:0; font-size:14px; font-weight:bold;">${loc.title}</h3>
          <p style="margin:5px 0 0 0; font-size:12px;">Wait time: <strong>${loc.waitTime} min</strong></p>
        </div>
      `,
      ariaLabel: loc.title
    });

    marker.addListener("click", () => {
      infoWindow.open({
        anchor: marker,
        map: mapInstance,
      });
    });

    markers.push(marker);
  });
};
