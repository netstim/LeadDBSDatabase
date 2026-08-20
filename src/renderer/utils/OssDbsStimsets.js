import * as iso from 'isosurface';
import * as nifti from 'nifti-reader-js';
import * as math from 'mathjs';
import * as THREE from 'three';

function typedArrayFor(code) {
  const n1 = nifti.NIFTI1; // enum with the standard codes

  switch (code) {
    case n1.TYPE_UINT8:
      return Uint8Array; // 2  → 8‑bit unsigned
    case n1.TYPE_INT16:
      return Int16Array; // 4  → 16‑bit signed
    case n1.TYPE_INT32:
      return Int32Array; // 8  → 32‑bit signed
    case n1.TYPE_FLOAT32:
      return Float32Array; // 16 → 32‑bit float
    case n1.TYPE_FLOAT64:
      return Float64Array; // 64 → 64‑bit float
    /* add more cases (TYPE_UINT16, TYPE_INT8, …) if your data needs them */
    default:
      throw new Error(`Unsupported NIfTI datatype code: ${code}`);
  }
}

function nii2Mesh(header, image) {
  console.log('NII2MESH: ', header);
  const Typed = typedArrayFor(header.datatypeCode);
  let vox = new Typed(image);
  console.log(vox);
  const float32Array = new Float32Array(vox.length);
  for (let i = 0; i < vox.length; i++) {
    float32Array[i] = vox[i];
  }
  vox = float32Array;
  const [nx, ny, nz] = header.dims.slice(1, 4);

  // vox = gaussianSmooth(vox, nx, ny, nz);

  const isoLevel = 0.3;
  const scalar = (x, y, z) => vox[x + nx * (y + ny * z)] - isoLevel;
  const mesh = iso.marchingCubes([nx, ny, nz], scalar);

  if (mesh.positions.length === 0) {
    throw new Error('No voxels ≥ isoLevel – check datatype / isoLevel.');
  }

  // Apply Gaussian smoothing

  // --- scale vertices using affine matrix ---------------------------------
  const affineMatrix = header.affine; // Assuming affine matrix is available
  mesh.positions = mesh.positions.map(([x, y, z]) => {
    const voxelHomogeneous = [x + 0.5, y + 0.5, z + 0.5, 1]; // Add 0.5 for center of voxel
    const transformedVoxels = math.multiply(affineMatrix, voxelHomogeneous);
    return transformedVoxels.slice(0, 3); // Return only x, y, z
  });

  // --- Three.js geometry ---------------------------------------------------
  // const geo = new BufferGeometry();
  // geo.setAttribute(
  //   'position',
  //   new Float32BufferAttribute(mesh.positions.flat(), 3),
  // );
  // geo.setIndex(new Uint32BufferAttribute(mesh.cells.flat(), 1));
  // geo.computeVertexNormals();
  // return geo;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(mesh.positions.flat());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // Add faces (indices)
  // const indices = new Uint32Array(mesh.cells.flat());
  // geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  const indices = new Uint32Array(mesh.cells.flat());
  for (let i = 0; i < indices.length; i += 3) {
    // Swap the order of the indices to reverse the winding
    const temp = indices[i];
    indices[i] = indices[i + 1];
    indices[i + 1] = temp;
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  // Compute vertex normals
  geometry.computeVertexNormals();

  // // Set vertex colors
  const colors = new Float32Array(positions.length);
  for (let i = 0; i < positions.length / 3; i++) {
    const value = vox[i];
    const normalizedValue = Math.min(1, Math.max(0, value / 255)); // Normalize to [0, 1]
    colors.set([normalizedValue, normalizedValue, normalizedValue], i * 3); // Grayscale color
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: false,
    opacity: 1,
    // smoothShading: true,
    color: 'red',
  });

  return { geometry, material };
}

/**
 * Converts superimposed E-field data into a PLY surface mesh for visualization.
 * @param {Float32Array} eFieldSuperimposed - The superimposed E-field data (4D vector field).
 * @param {Float32Array} eFieldMagnitude - The magnitude of the E-field (3D scalar field).
 * @param {Array} dimensions - The dimensions of the E-field data [xDim, yDim, zDim].
 * @returns {string} - PLY data as a string.
 */
function eFieldToSurfacePLY(
  eFieldSuperimposed,
  eFieldMagnitude,
  dimensions,
  header,
) {
  const [xDim, yDim, zDim] = dimensions;
  // Convert E-field data into mm coordinates
  const eFieldSuperimposedMM = new Float32Array(eFieldSuperimposed.length);
  const eFieldMagnitudeMM = new Float32Array(eFieldMagnitude.length);

  const affineMatrix = header.affine; // Assuming you have access to the affine matrix from the header

  for (let z = 0; z < zDim; z++) {
    for (let y = 0; y < yDim; y++) {
      for (let x = 0; x < xDim; x++) {
        const index = x + xDim * (y + yDim * z);
        const voxelHomogeneous = [x, y, z, 1]; // Add 1 for homogeneous transformation
        const transformedVoxels = math.multiply(affineMatrix, voxelHomogeneous);
        const [wx, wy, wz] = transformedVoxels.slice(0, 3);

        eFieldSuperimposedMM[index] = eFieldSuperimposed[index]; // Assuming no change in value
        eFieldMagnitudeMM[index] = eFieldMagnitude[index]; // Assuming no change in value
      }
    }
  }

  console.log('Running Marching Cubes...');

  // Generate surface mesh using Marching Cubes algorithm with superimposed E-field data
  const mesh = isosurface.marchingCubes(
    [xDim, yDim, zDim],
    (x, y, z) => {
      const index = x + xDim * (y + yDim * z);
      // Use the magnitude of the superimposed E-field vector as the scalar field
      const ex = eFieldSuperimposedMM[index * 3];
      const ey = eFieldSuperimposedMM[index * 3 + 1];
      const ez = eFieldSuperimposedMM[index * 3 + 2];
      return Math.sqrt(ex * ex + ey * ey + ez * ez);
    },
    (x, y, z) => {
      const index = x + xDim * (y + yDim * z);
      if (index * 3 + 2 >= eFieldSuperimposedMM.length) {
        throw new Error(`Index out of bounds: ${index}`);
      }
      return [
        eFieldSuperimposedMM[index * 3],
        eFieldSuperimposedMM[index * 3 + 1],
        eFieldSuperimposedMM[index * 3 + 2],
      ];
    }
  );

  console.log(
    `Generated ${mesh.positions.length} vertices and ${mesh.cells.length} faces.`,
  );

  if (mesh.positions.length === 0) {
    throw new Error('No surface extracted. Check data values.');
  }

  // Convert faces to PLY format
  const faces = mesh.cells.map(([a, b, c]) => `3 ${a} ${b} ${c}`);

  // Construct PLY data as a string
  let plyContent = `ply
format ascii 1.0
element vertex ${mesh.positions.length}
property float x
property float y
property float z
element face ${faces.length}
property list uchar int vertex_index
end_header
`;

  mesh.positions.forEach(([x, y, z]) => {
    plyContent += `${x} ${y} ${z}\n`;
  });

  faces.forEach((face) => {
    plyContent += `${face}\n`;
  });

  // Convert PLY string to ArrayBuffer
  const encoder = new TextEncoder();
  const plyArrayBuffer = encoder.encode(plyContent).buffer;

  return plyArrayBuffer;
}

/**
 * Computes the superimposed electric field from unit-contact solutions.
 * @param {Float32Array} stimVector - Array of stimulation currents for each contact (in Amperes).
 * @param {ArrayBuffer[]} efieldContactSolutions - Array of NIfTI file buffers for each contact.
 * @returns {Object} - Contains the superimposed E-field (`eFieldSuperimposed`) and its magnitude (`eFieldMagnitude`).
 */
function computeSuperimposedEField(stimVector, efieldContactSolutions) {
  let niftiHeader = null;
  let niftiData = null;
  let dimensions = null;

  // Load the first NIfTI file as the base field
  if (nifti.isNIFTI(efieldContactSolutions[0])) {
    const firstNifti = nifti.readHeader(efieldContactSolutions[0]);
    let firstData = nifti.readImage(firstNifti, efieldContactSolutions[0]);

    // Handle endian mismatch
    if (!firstNifti.littleEndian) {
      const dataView = new DataView(firstData);
      const correctedData = new Float64Array(firstData.byteLength / 8);
      for (let i = 0; i < correctedData.length; i++) {
        correctedData[i] = dataView.getFloat64(i * 8, false); // false = big-endian
      }
      firstData = correctedData;
    } else {
      firstData = new Float64Array(firstData);
    }

    niftiHeader = firstNifti;
    dimensions = firstNifti.dims.slice(1, 4); // Get spatial dimensions
    const voxelCount = dimensions.reduce((a, b) => a * b, 1);

    // Initialize superimposed E-field array (4D)
    niftiData = new Float64Array(voxelCount * 3); // Assuming 3 components per voxel

    // Scale first contact field
    for (let i = 0; i < niftiData.length; i++) {
      niftiData[i] = firstData[i] * stimVector[0];
    }
  } else {
    throw new Error('Invalid NIfTI file provided.');
  }

  // Superimpose the rest of the contacts
  for (let contactIdx = 1; contactIdx < stimVector.length; contactIdx++) {
    if (nifti.isNIFTI(efieldContactSolutions[contactIdx])) {
      let contactData = nifti.readImage(
        nifti.readHeader(efieldContactSolutions[contactIdx]),
        efieldContactSolutions[contactIdx],
      );

      // Handle endian mismatch
      if (!niftiHeader.littleEndian) {
        const dataView = new DataView(contactData);
        const correctedData = new Float64Array(contactData.byteLength / 8);
        for (let i = 0; i < correctedData.length; i++) {
          correctedData[i] = dataView.getFloat64(i * 8, false); // false = big-endian
        }
        contactData = correctedData;
      } else {
        contactData = new Float64Array(contactData);
      }

      for (let i = 0; i < niftiData.length; i++) {
        niftiData[i] += contactData[i] * stimVector[contactIdx];
      }
    } else {
      throw new Error(`Invalid NIfTI file at index ${contactIdx}`);
    }
  }

  // Determine an appropriate threshold based on niftiData values
  const values = niftiData.map((value) => value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const threshold = (maxValue + minValue) / 2; // Example: midpoint threshold

  // Binarize niftiData based on the calculated threshold
  const binarizedData = new Float32Array(niftiData.length);
  for (let i = 0; i < niftiData.length; i++) {
    binarizedData[i] = niftiData[i] > threshold ? 1 : 0;
  }

  // Compute magnitude of the final E-field (3D output)
  let eFieldMagnitude = new Float64Array(niftiData.length);
  for (let i = 0; i < eFieldMagnitude.length; i++) {
    let ex = niftiData[i * 3];
    let ey = niftiData[i * 3 + 1];
    let ez = niftiData[i * 3 + 2];
    eFieldMagnitude[i] = Math.sqrt(ex * ex + ey * ey + ez * ez) * 1000.0; // Convert to V/m
  }
  console.log('binarizedData: ', binarizedData);
  const mesh = nii2Mesh(niftiHeader, binarizedData);

  return {
    eFieldSuperimposed: niftiData,
    eFieldMagnitude: eFieldMagnitude,
    header: niftiHeader,
    mesh: mesh,
  };
}

export { computeSuperimposedEField, eFieldToSurfacePLY };
