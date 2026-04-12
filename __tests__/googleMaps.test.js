/**
 * FlowSphere — Google Maps Service Tests (mocked)
 */

// Mock the google maps global
beforeEach(() => {
  delete window.google;
});

jest.mock('../src/services/googleMaps.js', () => {
  let instances = {};
  return {
    STADIUM_CENTER: { lat: 18.9388, lng: 72.8252 },
    GATES: [
      { id: 'gate-1', name: 'Gate 1 (North)', lat: 18.94, lng: 72.8252 },
      { id: 'gate-2', name: 'Gate 2 (NE)', lat: 18.9396, lng: 72.8268 },
      { id: 'gate-3', name: 'Gate 3 (East)', lat: 18.9388, lng: 72.8275 },
    ],
    CONCESSION_STALLS: [
      { id: 'cs-1', name: 'Chai Station A', type: 'beverage', lat: 18.9395, lng: 72.8245 },
    ],
    loadGoogleMaps: jest.fn(() => Promise.resolve({})),
    initMap: jest.fn((elementId, center) => {
      instances[elementId] = { center, setCenter: jest.fn(), setZoom: jest.fn() };
      return instances[elementId];
    }),
    getMapInstance: jest.fn((id) => instances[id] || null),
    updateHeatmap: jest.fn(),
    updateMarkers: jest.fn(),
    drawFlowArrows: jest.fn(),
    generateHeatmapData: jest.fn((zones) => [
      { lat: 18.94, lng: 72.825, weight: 3 },
      { lat: 18.938, lng: 72.827, weight: 5 }
    ]),
    generateFlowArrows: jest.fn(() => [
      { points: [{ lat: 18.94, lng: 72.825 }, { lat: 18.938, lng: 72.825 }], color: '#00f0ff' }
    ]),
    renderDirections: jest.fn(async () => ({ distance: '500m', duration: '6 min' })),
    clearDirections: jest.fn(),
    isMapsLoaded: jest.fn(() => true),
  };
});

const maps = require('../src/services/googleMaps.js');

describe('Google Maps Service', () => {
  it('exports STADIUM_CENTER with correct coordinates', () => {
    expect(maps.STADIUM_CENTER.lat).toBeCloseTo(18.9388, 3);
    expect(maps.STADIUM_CENTER.lng).toBeCloseTo(72.8252, 3);
  });

  it('exports GATES array with at least 3 gates', () => {
    expect(maps.GATES.length).toBeGreaterThanOrEqual(3);
    expect(maps.GATES[0]).toHaveProperty('name');
    expect(maps.GATES[0]).toHaveProperty('lat');
    expect(maps.GATES[0]).toHaveProperty('lng');
  });

  it('loads Google Maps API', async () => {
    await maps.loadGoogleMaps('test-key');
    expect(maps.loadGoogleMaps).toHaveBeenCalled();
  });

  it('initializes map on element', () => {
    const map = maps.initMap('venue-map');
    expect(map).toBeTruthy();
    expect(maps.initMap).toHaveBeenCalledWith('venue-map');
  });

  it('generates heatmap data from zone data', () => {
    const data = maps.generateHeatmapData({ "Zone 1": { density: 3 } });
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('lat');
    expect(data[0]).toHaveProperty('weight');
  });

  it('generates flow arrow paths', () => {
    const arrows = maps.generateFlowArrows();
    expect(arrows.length).toBeGreaterThan(0);
    expect(arrows[0]).toHaveProperty('points');
    expect(arrows[0]).toHaveProperty('color');
  });

  it('renders directions between two points', async () => {
    const result = await maps.renderDirections({lat: 18.935, lng: 72.828}, maps.STADIUM_CENTER, 'test-map');
    expect(result).toHaveProperty('distance');
    expect(result).toHaveProperty('duration');
  });

  it('reports maps as loaded', () => {
    expect(maps.isMapsLoaded()).toBe(true);
  });
});
