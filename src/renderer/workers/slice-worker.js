/*  message.data = {
      coords : Float32Array  (packed [x,y,z,r,x,y,z,r,…] in MNI mm, r∈[0,1])
      dims   : [nx, ny, nz]  (template voxel counts, e.g. [182,218,182])
      axis   : 0|1|2         (0=sagittal  1=coronal  2=axial)
      plane  : Number        (mm of the desired slice on that axis)
  }  →  returns { buffer }  where buffer is Uint8Array of size nx*ny          */
onmessage = ({ data }) => {
  const { coords, dims, axis, plane } = data;
  const [nx, ny, nz] = dims;
  const half = [nx / 2, ny / 2, nz / 2];
  const outW = axis === 2 ? nx : axis === 1 ? nx : ny;
  const outH = axis === 2 ? ny : nz;

  const slice = new Uint8Array(outW * outH); // zero-filled
  const arr = new Float32Array(coords); // view the buffer
  const fixMM = Math.round(plane); // nearest mm layer

  for (let i = 0; i < arr.length; i += 4) {
    const x = arr[i];
    const y = arr[i + 1];
    const z = arr[i + 2];
    if (Math.round(axis === 0 ? x : axis === 1 ? y : z) !== fixMM) continue;

    let xi;
    let yi;
    if (axis === 2) {
      // axial : x ↦ col, y ↦ row
      xi = Math.round(x + half[0]);
      yi = Math.round(y + half[1]);
    } else if (axis === 1) {
      // coronal : x ↦ col, z ↦ row
      xi = Math.round(x + half[0]);
      yi = Math.round(z + half[2]);
    } else {
      // sagittal : y ↦ col, z ↦ row
      xi = Math.round(y + half[1]);
      yi = Math.round(z + half[2]);
    }
    if (xi < 0 || xi >= outW || yi < 0 || yi >= outH) continue;

    const idx = xi + yi * outW;
    const val8 = Math.min(255, Math.max(slice[idx], arr[i + 3] * 255));
    slice[idx] = val8; // keep brightest if clash
  }
  postMessage({ buffer: slice.buffer }, [slice.buffer]); // transfer-list = zero-copy
};
