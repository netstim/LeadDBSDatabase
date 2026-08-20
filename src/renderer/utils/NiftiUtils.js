import * as nifti from 'nifti-reader-js';
import * as iso from 'isosurface';
import * as THREE from 'three';
import * as math from 'mathjs';
// import * as grayscaleColormap from 'grayscale-colormap';

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

function gaussianSmooth(vox, nx, ny, nz, sigma = 1.0) {
  const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
  const kernel = new Float32Array(kernelSize);
  const halfSize = Math.floor(kernelSize / 2);
  const sigma2 = sigma * sigma;
  let sum = 0;

  for (let i = -halfSize; i <= halfSize; i++) {
    const value = Math.exp(-(i * i) / (2 * sigma2));
    kernel[i + halfSize] = value;
    sum += value;
  }

  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum;
  }

  const smoothVox = new Float32Array(vox.length);

  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        let sum = 0;
        for (let dz = -halfSize; dz <= halfSize; dz++) {
          for (let dy = -halfSize; dy <= halfSize; dy++) {
            for (let dx = -halfSize; dx <= halfSize; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              const nz = z + dz;
              if (
                nx >= 0 &&
                nx < nx &&
                ny >= 0 &&
                ny < ny &&
                nz >= 0 &&
                nz < nz
              ) {
                const index = nx + ny * nx + nz * nx * ny;
                sum +=
                  vox[index] *
                  kernel[dx + halfSize] *
                  kernel[dy + halfSize] *
                  kernel[dz + halfSize];
              }
            }
          }
        }
        const index = x + y * nx + z * nx * ny;
        smoothVox[index] = sum;
      }
    }
  }

  return smoothVox;
}

function nii2Mesh(raw) {
  const header = nifti.readHeader(raw);
  const image = nifti.readImage(header, raw);
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

  const isoLevel = 0.5;
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

  // Set vertex colors
  const colors = new Float32Array(positions.length);
  for (let i = 0; i < positions.length / 3; i++) {
    const value = vox[i];
    const normalizedValue = Math.min(1, Math.max(0, value / 255)); // Normalize to [0, 1]
    colors.set([normalizedValue, normalizedValue, normalizedValue], i * 3); // Grayscale color
  }
  // geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshStandardMaterial({
    color: 'red',
    shininess: 100, // Increase shininess for a smoother appearance
    specular: 0x111111, // Specular color for highlights
    transparent: true,
    opacity: 0.8,
  });

  return { geometry, material };
}

function extractSlice(vox, nx, ny, nz, axis, index) {
  const slice = [];
  if (axis === 'x') {
    for (let z = 0; z < nz; z++) {
      for (let y = 0; y < ny; y++) {
        slice.push(vox[index + y * nx + z * nx * ny]);
      }
    }
  } else if (axis === 'y') {
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        slice.push(vox[x + index * nx + z * nx * ny]);
      }
    }
  } else if (axis === 'z') {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        slice.push(vox[x + y * nx + index * nx * ny]);
      }
    }
  }
  return slice;
}

function createTextureFromSlice(slice, width, height) {
  const textureData = new Uint8Array(slice.length * 4);
  for (let i = 0; i < slice.length; i++) {
    const value = slice[i];
    // Normalize value if necessary
    const normalizedValue = Math.min(255, Math.max(0, value)); // Ensure value is between 0 and 255
    textureData[i * 4] = normalizedValue; // R
    textureData[i * 4 + 1] = normalizedValue; // G
    textureData[i * 4 + 2] = normalizedValue; // B
    textureData[i * 4 + 3] = 255; // A
  }
  const texture = new THREE.DataTexture(
    textureData,
    width,
    height,
    THREE.RGBAFormat,
  );
  texture.needsUpdate = true;
  return texture;
}

function addSliceToScene(
  scene,
  vox,
  nx,
  ny,
  nz,
  axis = 'z',
  index = Math.floor(nz / 2),
  affineMatrix,
) {
  const slice = extractSlice(vox, nx, ny, nz, axis, index);

  const geometry = new THREE.PlaneGeometry(nx, ny);
  const colors = new Float32Array(nx * ny * 3);

  for (let i = 0; i < slice.length; i++) {
    const value = slice[i];
    const normalizedValue = Math.min(1, Math.max(0, value / 255)); // Normalize to [0, 1]
    colors[i * 3] = normalizedValue; // R
    colors[i * 3 + 1] = normalizedValue; // G
    colors[i * 3 + 2] = normalizedValue; // B
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshBasicMaterial({ vertexColors: true });
  const plane = new THREE.Mesh(geometry, material);

  // Convert the slice position to MNI coordinates using the affine matrix
  const voxelHomogeneous = [0.5, 0.5, 0.5, 1]; // Center of the voxel
  if (axis === 'x') {
    voxelHomogeneous[0] = index + 0.5;
  } else if (axis === 'y') {
    voxelHomogeneous[1] = index + 0.5;
  } else if (axis === 'z') {
    voxelHomogeneous[2] = index + 0.5;
  }

  const mniCoordinates = math.multiply(affineMatrix, voxelHomogeneous);
  plane.position.set(mniCoordinates[0], mniCoordinates[1], mniCoordinates[2]);

  scene.add(plane);
}

function buildSliceTexture(
  mniCoords,
  dims = [182, 218, 182],
  axis = 2,
  mniPlane = 0,
) {
  /* ----- work out slice canvas size & index mapping ---------------- */
  let w;
  let h;
  let getXi;
  let getYi;

  const half = dims.map((d) => d / 2); // +mm → +voxel index shift

  if (axis === 2) {
    // axial   (X-Y   image,  Z layer fixed)
    w = dims[0];
    h = dims[1];
    getXi = (p) => Math.round(p[0] + half[0]); // x → column
    getYi = (p) => Math.round(p[1] + half[1]); // y → row
  } else if (axis === 1) {
    // coronal (X-Z   image,  Y layer fixed)
    w = dims[0];
    h = dims[2];
    getXi = (p) => Math.round(p[0] + half[0]); // x → column
    getYi = (p) => Math.round(p[2] + half[2]); // z → row
  } else {
    // sagittal(Y-Z   image,  X layer fixed)
    w = dims[1];
    h = dims[2];
    getXi = (p) => Math.round(p[1] + half[1]); // y → column
    getYi = (p) => Math.round(p[2] + half[2]); // z → row
  }

  /* ---------- allocate empty 8-bit buffer for this 2-D slice -------- */
  const buf = new Uint8Array(w * h).fill(0);

  /* ---------- copy all points that fall **on** the chosen plane ----- */
  mniCoords.forEach((p) => {
    const pos = [p[0], p[1], p[2]];
    const r = p[3]; // already arctan-scaled → [0,1]

    if (Math.round(pos[axis]) !== mniPlane) return; // keep this layer only

    const xi = getXi(pos);
    const yi = getYi(pos);
    if (xi < 0 || xi >= w || yi < 0 || yi >= h) return;

    const idx = xi + yi * w;
    buf[idx] = Math.max(buf[idx], Math.round(r * 255)); // max-intensity-projection in case of clashes
  });

  /* ---------- build a 1-layer DataArrayTexture (needs WebGL-2) ------ */
  const tex = new THREE.DataArrayTexture(buf, w, h, 1);
  tex.format = THREE.RedFormat; // single-channel
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;

  return { texture: tex, width: w, height: h };
}

function buildSliceMesh(
  voxelList,           // Float32Array OR Array<[x,y,z,r]>
  affine,              // Float32Array(16) 4×4, row-major
  dims,                // [nx,ny,nz]
  axis    = 2,         // 0=sag, 1=cor, 2=ax
  planeMM = 0
) {
  const [nx, ny, nz] = dims;
  const half = [nx / 2, ny / 2, nz / 2];

  const width  = axis === 2 ? nx : (axis === 1 ? nx : ny);
  const height = axis === 2 ? ny : nz;
  const depth = axis === 2 ? nz : (axis === 1 ? ny : nx);
  const buf = new Uint8Array(width * height * depth); // 3D buffer

  // Cache affine into locals for JIT speed
  const m = affine;
  const m00 = m[0], m01 = m[1], m02 = m[2],  m03 = m[3],
        m10 = m[4], m11 = m[5], m12 = m[6],  m13 = m[7],
        m20 = m[8], m21 = m[9], m22 = m[10], m23 = m[11];

  const wanted = Math.round(planeMM);

  // Iterate over voxelList
  if (voxelList instanceof Float32Array) {
    for (let i = 0; i < voxelList.length; i += 4) {
      const xV = voxelList[i], yV = voxelList[i + 1], zV = voxelList[i + 2];
      const r = voxelList[i + 3];

      const X = m00 * xV + m01 * yV + m02 * zV + m03;
      const Y = m10 * xV + m11 * yV + m12 * zV + m13;
      const Z = m20 * xV + m21 * yV + m22 * zV + m23;

      const ax = axis === 0 ? X : axis === 1 ? Y : Z;
      if (Math.round(ax) !== wanted) continue;

      let xi, yi;
      if (axis === 2) { xi = Math.round(X + half[0]); yi = Math.round(Y + half[1]); }
      else if (axis === 1) { xi = Math.round(X + half[0]); yi = Math.round(Z + half[2]); }
      else { xi = Math.round(Y + half[1]); yi = Math.round(Z + half[2]); }

      if (xi < 0 || xi >= width || yi < 0 || yi >= height) continue;
      const idx = xi + yi * width;
      const val = r * 255 | 0;
      if (val > buf[idx]) buf[idx] = val;
    }
  } else {
    for (let k = 0; k < voxelList.length; k++) {
      const [xV, yV, zV, r] = voxelList[k];

      const X = m00 * xV + m01 * yV + m02 * zV + m03;
      const Y = m10 * xV + m11 * yV + m12 * zV + m13;
      const Z = m20 * xV + m21 * yV + m22 * zV + m23;

      const ax = axis === 0 ? X : axis === 1 ? Y : Z;
      if (Math.round(ax) !== wanted) continue;

      let xi, yi;
      if (axis === 2) { xi = Math.round(X + half[0]); yi = Math.round(Y + half[1]); }
      else if (axis === 1) { xi = Math.round(X + half[0]); yi = Math.round(Z + half[2]); }
      else { xi = Math.round(Y + half[1]); yi = Math.round(Z + half[2]); }

      if (xi < 0 || xi >= width || yi < 0 || yi >= height) continue;
      const idx = xi + yi * width;
      const val = r * 255 | 0;
      if (val > buf[idx]) buf[idx] = val;
    }
  }

  // Create the DataArrayTexture
  const tex = new THREE.DataArrayTexture(
    buf,
    width,
    height,
    depth,
    THREE.RedFormat,
    THREE.UnsignedByteType
  );
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;

  // Create a plane geometry for a single slice
  const geo = new THREE.PlaneGeometry(width, height);

  // Use a shader material to select the correct slice
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: tex },
      uSlice: { value: 0 } // Uniform to select the slice
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2DArray uTex;
      uniform float uSlice;
      varying vec2 vUv;
      void main() {
        vec4 color = texture(uTex, vec3(vUv, uSlice));
        gl_FragColor = color;
      }
    `
  });

  // Create the mesh
  const mesh = new THREE.Mesh(geo, mat);

  return mesh;
}

function nii2mni(header, voxelCoordinates) {
  const affineMatrix = header.affine;
  const mniCoordinates = voxelCoordinates.map(([x, y, z, value]) => {
    const voxelHomogeneous = [x, y, z, 1]; // Add 1 for homogeneous transformation
    const transformedVoxels = math.multiply(affineMatrix, voxelHomogeneous);
    let [wx, wy, wz] = transformedVoxels.slice(0, 3);
    [wx, wy, wz] = [
      Math.round(wx * 10) / 10,
      Math.round(wy * 10) / 10,
      Math.round(wz * 10) / 10,
    ];
    return [wx, wy, wz, value];
  });
  // const normalizedMniCoords = mniCoordinates.map(([x, y, z, r]) => {
  //   // Apply arctan normalization
  //   const normalizedR = Math.atan(r); // Normalize arctan(r) to [0, 1]
  //   // Return the updated coordinate array with normalized R
  //   return [x, y, z, normalizedR];
  // });
  // return normalizedMniCoords;
  return mniCoordinates;
}

function makeAxialSliceTexture(mni, dims, zMM) {
  const [nx, ny, nz] = dims;
  const half = [nx / 2, ny / 2, nz / 2];

  /* ---------- allocate one byte per pixel ------------------ */
  const buf = new Uint8Array(nx * ny); // auto-filled with 0

  /* ---------- rasterise all points on this Z plane --------- */
  const zTarget = Math.round(zMM); // nearest mm layer

  for (let i = 0; i < mni.length; i++) {
    const [x, y, z, r] = mni[i];

    if (Math.round(z) !== zTarget) continue; // skip other layers

    const xi = Math.round(x + half[0]);
    const yi = Math.round(y + half[1]);

    if (xi < 0 || xi >= nx || yi < 0 || yi >= ny) continue;

    const texIndex = xi + yi * nx;
    buf[texIndex] = Math.max(buf[texIndex], r * 255); // keep brightest
  }

  /* ---------- turn into 1-channel DataTexture -------------- */
  const tex = new THREE.DataTexture(
    buf,
    nx,
    ny,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

function addSliceTest(header, voxelCoordinates, scene) {
  const sliceMesh = buildSliceMesh(
    voxelCoordinates,            // your raw voxel cloud
    header.affine,               // 4×4 affine from the NIfTI
    header.dims.slice(1, 4),     // [nx, ny, nz]
    2,                            // axis 2 = axial
    +0                           // show the +20 mm plane
  );

  // scene.add(sliceMesh);
  return sliceMesh;
  // const mniCoordinates = nii2mni(header, normalized);
  // const affineMatrix = header.affine;
  // const mniCoordinates = normalized.map(([x, y, z, value]) => {
  //   const voxelHomogeneous = [x, y, z, 1]; // Add 1 for homogeneous transformation
  //   const transformedVoxels = math.multiply(affineMatrix, voxelHomogeneous);
  //   const [wx, wy, wz] = transformedVoxels.slice(0, 3);
  //   return [wx, wy, wz, value];
  // });
  // console.log('MNI Coordinates:', mniCoordinates);
  // const sliceIndex = 0; // Taking a slice where all x values = 0
  // const sliceCoordinates = mniCoordinates.filter(
  //   ([x, y, z, value]) => x === sliceIndex,
  // );

  // const sliceGeometry = new THREE.PlaneGeometry(header.dims[1], header.dims[2]);
  // const sliceTexture = createTextureFromSlice(
  //   sliceCoordinates.map((coord) => coord[3]),
  //   header.dims[1],
  //   header.dims[2],
  // );

  // const sliceMaterial = new THREE.MeshBasicMaterial({
  //   map: sliceTexture,
  //   side: THREE.DoubleSide,
  // });
  // const sliceMesh = new THREE.Mesh(sliceGeometry, sliceMaterial);
  // scene.add(sliceMesh);
  // const axialTex = makeAxialSliceTexture(
  //   mniCoordinates,
  //   header.dims.slice(1, 4), // [nx,ny,nz]
  //   +20, // z (mm)
  // );

  // // 3.  Geometry the exact size of that axial layer:
  // const [nx, ny] = header.dims.slice(1, 3);
  // const axialGeo = new THREE.PlaneGeometry(nx, ny).translate(
  //   nx / 2 - nx / 2,
  //   ny / 2 - ny / 2,
  //   0,
  // ); // centre (0,0)

  // const axialMat = new THREE.MeshBasicMaterial({
  //   map: axialTex,
  //   side: THREE.DoubleSide,
  // });
  // const axialMesh = new THREE.Mesh(axialGeo, axialMat);

  // // 4.  Orient and position so world units == millimetres:
  // axialMesh.rotation.x = -Math.PI / 2; // axial plane faces camera
  // axialMesh.position.z = +20; // exactly at Z = +20 mm

  // scene.add(axialMesh);
  // 2.  build the texture of one axial slice at Z = +20 mm
  //   const { texture, width, height } = buildSliceTexture(
  //     mniCoordinates,
  //     header.dims.slice(1, 4), // voxel dims from NIfTI
  //     2, // axial
  //     +20,
  //   ); // mm

  //   // 3.  make a plane that sits exactly at Z = +20 mm
  //   const half = header.dims.slice(1, 4).map((d) => d / 2);
  //   const plane = new THREE.Mesh(
  //     new THREE.PlaneGeometry(width, height).translate(
  //       width / 2 - half[0],
  //       height / 2 - half[1],
  //       0,
  //     ), // centre (0,0)
  //     new THREE.RawShaderMaterial({
  //       uniforms: { uTex: { value: texture } },
  //       vertexShader: `
  //     precision mediump float; precision mediump int;
  //     uniform mat4 modelViewMatrix, projectionMatrix;
  //     in vec3 position; in vec2 uv;
  //     out vec2 vUv;
  //     void main(){
  //     vUv = uv;
  //     gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
  //     }`,
  //       fragmentShader: `#version 300 es
  //     precision mediump float; precision mediump int;
  //     uniform highp sampler2DArray uTex;
  //     in  vec2 vUv;  out vec4 frag;
  //     void main(){
  //     float g = texture(uTex, vec3(vUv, 0.)).r;   // layer 0
  //     frag = vec4(vec3(g), 1.);
  //     }`,
  //     }),
  //   );
  //   plane.rotation.x = -Math.PI / 2; // axial → face camera
  //   plane.position.z = 20; // place at +20 mm in world (MNI) space
  //   scene.add(plane);
  // console.log('Running...');
  // const flat = new Float32Array(mniCoordinates.length * 4);
  // mniCoordinates.forEach((p, k) => flat.set(p, k * 4));

  // // ----  spin up the worker and ask for one axial slice at Z = +20 mm ----
  // const worker = new Worker('./slice-worker.js');
  // worker.postMessage(
  //   {
  //     coords: flat.buffer, // zero-copy
  //     dims: header.dims.slice(1, 4), // [nx,ny,nz]
  //     axis: 2, // axial
  //     plane: +20, // mm
  //   },
  //   [flat.buffer],
  // ); // transfer so the big array leaves the main thread

  // worker.onmessage = ({ data }) => {
  //   const { buffer } = data;
  //   const [nx, ny] = header.dims.slice(1, 3);

  //   const tex = new THREE.DataTexture(
  //     new Uint8Array(buffer),
  //     nx,
  //     ny,
  //     THREE.RedFormat,
  //     THREE.UnsignedByteType,
  //   );
  //   tex.needsUpdate = true;
  //   tex.minFilter = tex.magFilter = THREE.NearestFilter;
  //   tex.unpackAlignment = 1;

  //   // ----  geometry in millimetres so it lines up with everything else ----
  //   const geo = new THREE.PlaneGeometry(nx, ny).translate(nx / 2, ny / 2, 0); // centre at (0,0)

  //   const mat = new THREE.MeshBasicMaterial({
  //     map: tex,
  //     side: THREE.DoubleSide,
  //   });
  //   const mesh = new THREE.Mesh(geo, mat);
  //   mesh.rotation.x = -Math.PI / 2; // axial faces camera
  //   mesh.position.z = 20; // exactly at +20 mm
  //   scene.add(mesh);
  // };
}

function addSlice(header) {
  const nx = 10; // Number of columns
  const ny = 10; // Number of rows

  // Generate fake voxel data
  const voxelCoordinates = [];
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const value = Math.random() * 255; // Random value between 0 and 255
      voxelCoordinates.push([x, y, 0, value]); // z is 0 for a 2D plane
    }
  }

  // Create a Float32Array for colors
  const colors = new Float32Array(voxelCoordinates.length * 3);
  voxelCoordinates.forEach(([x, y, z, value], i) => {
    const normalizedValue = value / 255;
    colors[i * 3] = normalizedValue; // R
    colors[i * 3 + 1] = normalizedValue; // G
    colors[i * 3 + 2] = normalizedValue; // B
  });

  // Create the plane geometry
  const geometry = new THREE.PlaneGeometry(nx, ny);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Create the material
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });

  // Create the mesh
  const mesh = new THREE.Mesh(geometry, material);


  return mesh;
}

function processNifti(raw, scene) {
  const header = nifti.readHeader(raw);
  let image = nifti.readImage(header, raw);
  console.log('Header: ', header);
  // Ensure `image` is a valid ArrayBuffer
  if (!(image instanceof ArrayBuffer)) {
    console.log('Adjusting image to ArrayBuffer...');
    image = new Uint8Array(image).buffer;
  }

  // Handle endian mismatch
  if (!header.littleEndian) {
    console.warn('File is in big-endian format. Adjusting...');
    const dataView = new DataView(image);
    const correctedData = new Float32Array(image.byteLength / 4);
    for (let i = 0; i < correctedData.length; i++) {
      correctedData[i] = dataView.getFloat32(i * 4, false); // false = big-endian
    }
    image = correctedData;
  } else {
    image = new Float32Array(image);
  }

  // Apply scaling factors
  const { scl_slope = 1, scl_inter = 0 } = header;
  const img = new Float32Array(
    image.map((value) => value * scl_slope + scl_inter),
  );

  // Extract dimensions
  const dimensions = header.dims.slice(1, 4);
  console.log('Dimensions:', dimensions);

  // Generate voxel coordinates
  const voxelCoordinates = [];
  img.forEach((value, index) => {
    if (!isNaN(value)) {
      const z = Math.floor(index / (dimensions[0] * dimensions[1]));
      const y = Math.floor(
        (index % (dimensions[0] * dimensions[1])) / dimensions[0],
      );
      const x = index % dimensions[0];
      voxelCoordinates.push([x, y, z, value]);
    }
  });

  console.log('Voxel Coordinates:', voxelCoordinates);
  // const [nx, ny, nz] = header.dims.slice(1, 4);
  // const affineMatrix = header.affine;
  // const mniCoordinates = voxelCoordinates.map(([x, y, z, value]) => {
  //   const voxelHomogeneous = [x, y, z, 1]; // Add 1 for homogeneous transformation
  //   const transformedVoxels = math.multiply(affineMatrix, voxelHomogeneous);
  //   const [wx, wy, wz] = transformedVoxels.slice(0, 3);
  //   return [wx, wy, wz, value];
  // });
  // console.log('MNI Coordinates:', mniCoordinates);
  // Add a slice to the scene using MNI coordinates
  // addSliceToScene(scene, vox, nx, ny, nz, 'z', Math.floor(nz / 2), affineMatrix);
  // const mesh = addSliceTest(header, voxelCoordinates, scene);
  const mesh = addSlice(header);
  return mesh;
}

function addSliceToSceneNew(raw, scene) {
  const header = nifti.readHeader(raw);
  let image = nifti.readImage(header, raw);
  // console.log('Image: ', image);
  console.log('Header: ', header);
  // Ensure `image` is a valid ArrayBuffer
  if (!(image instanceof ArrayBuffer)) {
    console.log('Adjusting image to ArrayBuffer...');
    image = new Uint8Array(image).buffer;
  }

  // Handle endian mismatch
  if (!header.littleEndian) {
    console.warn('File is in big-endian format. Adjusting...');
    const dataView = new DataView(image);
    const correctedData = new Float32Array(image.byteLength / 4);
    for (let i = 0; i < correctedData.length; i++) {
      correctedData[i] = dataView.getFloat32(i * 4, false); // false = big-endian
    }
    image = correctedData;
  } else {
    image = new Float64Array(image);
  }

  // Apply scaling factors
  const { scl_slope, scl_inter } = header;
  const img = new Float64Array(
    image.map((value) => value * scl_slope + scl_inter),
  );
  console.log('Image: ', img);
  // Extract dimensions
  const dimensions = header.dims.slice(1, 4);
  console.log('Dimensions:', dimensions);

  // Generate voxel coordinates
  const voxelCoordinates = [];
  img.forEach((value, index) => {
    if (!isNaN(value)) {
      const z = Math.floor(index / (dimensions[0] * dimensions[1]));
      const y = Math.floor(
        (index % (dimensions[0] * dimensions[1])) / dimensions[0],
      );
      const x = index % dimensions[0];
      voxelCoordinates.push([x, y, z, value]);
    }
  });

  console.log('Voxel Coordinates:', voxelCoordinates);
  const mniCoordinates = nii2mni(header, voxelCoordinates);
  console.log('MNI Coordinates: ', mniCoordinates);
  const [nx, ny, nz] = header.dims.slice(1, 4);
  const plotCoords = [];
  let zVal = -10;
  for (let i = 0; i < mniCoordinates.length; i++) {
    const [x, y, z, value] = mniCoordinates[i];
    if (z === zVal) {
      plotCoords.push([x, y, zVal, value]); // z is 0 for a 2D plane
    }
  }
  const values = plotCoords.map(([x, y, z, value]) => value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const meanValue = values.reduce((acc, val) => acc + val, 0) / values.length;
  console.log('Max Value: ', maxValue, 'Mean Value: ', meanValue, 'Min Value: ', minValue);
  console.log('Plot Coordinates: ', plotCoords);

  const depth = nz; // Number of slices
  const size = nx * ny; // Number of pixels per slice
  const data = new Uint8Array(size * depth * 4); // RGBA for each pixel

  for (let i = 0; i < depth; i++) {
    for (let j = 0; j < size; j++) {
      const value = voxelCoordinates[i * size + j][3]; // Get the voxel value
      const normalizedValue = (value - minValue) / (maxValue - minValue); // Normalize to [0, 1]
      const intensity = Math.floor(normalizedValue * 255); // Convert to 0-255 range

      const stride = (i * size + j) * 4;
      data[stride] = intensity; // R
      data[stride + 1] = intensity; // G
      data[stride + 2] = intensity; // B
      data[stride + 3] = 255; // A
    }
  }

  // Create the DataArrayTexture
  const texture = new THREE.DataArrayTexture(data, nx, ny, depth);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  // Create a plane geometry for a single slice
  const geometry = new THREE.PlaneGeometry(nx, ny);

  // Use a shader material to select the correct slice
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: texture },
      uSlice: { value: 0 } // Uniform to select the slice
    },
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2DArray uTex;
      uniform float uSlice;
      varying vec2 vUv;
      void main() {
        vec4 color = texture(uTex, vec3(vUv, uSlice));
        gl_FragColor = color;
      }
    `
  });

  // Create the mesh
  const mesh = new THREE.Mesh(geometry, material);
  const position = [0, 0, zVal];
  const sliceCoordinates = { mniCoordinates, header, voxelCoordinates };
  // scene.add(mesh);
  return [mesh, position, sliceCoordinates];
}

function testPlane(scene) {
  const nx = 100; // Number of columns
  const ny = 100; // Number of rows

  // Generate fake voxel data
  const voxelCoordinates = [];
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const value = Math.random() * 255; // Random value between 0 and 255
      voxelCoordinates.push([x, y, 0, value]); // z is 0 for a 2D plane
    }
  }

  const colors = new Float64Array(voxelCoordinates.length * 3);
  voxelCoordinates.forEach(([x, y, z, value], i) => {
    const normalizedValue = value / 255;
    colors[i * 3] = normalizedValue; // R
    colors[i * 3 + 1] = normalizedValue; // G
    colors[i * 3 + 2] = normalizedValue; // B
  });

  // Create the plane geometry
  const geometry = new THREE.PlaneGeometry(nx, ny);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Create the material
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });

  // Create the mesh
  const mesh = new THREE.Mesh(geometry, material);

  // Set the position of the plane in 3D space
  mesh.position.set(0, 0, -10); // Adjust the x, y, z values as needed
    // mesh.position.z -= 100; // Adjust the value as needed to move the plane down
  console.log('Mesh: ', mesh);
  scene.add(mesh);
  return mesh;
}

export { nii2Mesh, processNifti, testPlane, addSliceToSceneNew };

