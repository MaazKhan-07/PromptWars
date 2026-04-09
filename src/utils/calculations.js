/**
 * Calculates a simulated wait time based on current demand.
 * @param {number} peopleInLine - The number of people in the queue.
 * @param {number} serviceRate - The average time (in seconds) to serve one person.
 * @returns {number} Estimated wait time in minutes.
 */
export const calculateWaitTime = (peopleInLine, serviceRate) => {
  if (peopleInLine < 0 || serviceRate < 0) return 0;
  return Math.ceil((peopleInLine * serviceRate) / 60);
};

/**
 * Calculates a crowd density score based on a specific area.
 * @param {number} peopleCount - Number of people in area.
 * @param {number} areaSquareMeters - Size of the area in square meters.
 * @returns {number} Density score (people per square meter).
 */
export const calculateDensityScore = (peopleCount, areaSquareMeters) => {
  if (areaSquareMeters <= 0) return 0;
  return (peopleCount / areaSquareMeters);
};

/**
 * Returns a severity level color dynamically based on density.
 * @param {number} density - The density score.
 * @returns {string} Severity level (green, yellow, orange, red).
 */
export const getDensitySeverity = (density) => {
  if (density < 2) return 'green';
  if (density < 4) return 'yellow';
  if (density < 5.5) return 'orange';
  return 'red';
};

/**
 * Returns color category for Wait Time Board.
 * @param {number} minutes Wait time in minutes
 * @returns {string} color category string.
 */
export const getWaitTimeCategory = (minutes) => {
  if (minutes < 5) return 'green';
  if (minutes <= 15) return 'yellow';
  return 'red';
};
