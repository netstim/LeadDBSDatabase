const { Niivue } = require('@niivue/niivue');
const THREE = require('three');

/**
 * Processes a NIfTI file using Niivue and generates a THREE.BufferGeometry for rendering.
 * @param {ArrayBuffer} niftiData - The NIfTI file data as an ArrayBuffer.
 * @returns {Promise<THREE.BufferGeometry>} - The generated geometry.
 */
async function processNii(niftiData) {
  // Create a Niivue instance
  const nv = new Niivue();

  // Load the NIfTI file into Niivue
  const volume = await nv.addVolumeFromArrayBuffer(niftiData, {
    name: 'Processed Volume',
  });

  // Extract volume data and dimensions
  const { data, dims } = volume; // `data` contains voxel intensities
  const [dimX, dimY, dimZ] = dims;

  // Create a geometry to hold the voxel data
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  // Iterate through the voxel data
  for (let z = 0; z < dimZ; z++) {
    for (let y = 0; y < dimY; y++) {
      for (let x = 0; x < dimX; x++) {
        const index = x + y * dimX + z * dimX * dimY;
        const intensity = data[index];

        // Skip low-intensity voxels (thresholding)
        if (intensity <= 0) continue;

        // Transform voxel coordinates to world coordinates
        const worldCoord = nv.voxelToWorld([x, y, z]);

        // Add the position to the geometry
        positions.push(worldCoord[0], worldCoord[1], worldCoord[2]);

        // Map intensity to a color (e.g., grayscale)
        const color = new THREE.Color(intensity / 255, intensity / 255, intensity / 255);
        colors.push(color.r, color.g, color.b);
      }
    }
  }

  // Add positions and colors to the geometry
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  return geometry;
}

module.exports = {
  processNii,
};
