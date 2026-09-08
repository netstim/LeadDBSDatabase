/* Generates a fake Lead-DBS dataset for testing the LeadDBSProgrammer viewer. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = process.argv[2];
if (!ROOT) throw new Error('Usage: node makeFakeDataset.js <outputRoot>');

const PATIENT = 'sub-FakePatient01';
const SESSION = 'Baseline';

// ---------- vector helpers ----------
const norm = (v) => {
  const m = Math.hypot(...v);
  return v.map((x) => x / m);
};
const add = (a, b) => a.map((x, i) => x + b[i]);
const scale = (v, s) => v.map((x) => x * s);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const round3 = (v) => v.map((x) => Math.round(x * 1000) / 1000);

// ---------- reconstruction (Boston Vercise Directed, oblique trajectories) ----------
// head = distal tip contact center, tail = head + 6mm along shaft (2mm level pitch).
const buildSide = (head, axisRaw) => {
  const axis = norm(axisRaw);
  const u = norm(cross(axis, [0, 0, 1])); // radial reference
  const v = norm(cross(axis, u));
  const radial = (angleDeg) => {
    const a = (angleDeg * Math.PI) / 180;
    return add(scale(u, 0.66 * Math.cos(a)), scale(v, 0.66 * Math.sin(a)));
  };
  const level = (k) => add(head, scale(axis, 2 * k));
  const contacts = [
    level(0), // contact 1 (tip ring)
    add(level(1), radial(0)), // 2a
    add(level(1), radial(120)), // 2b
    add(level(1), radial(240)), // 2c
    add(level(2), radial(0)), // 3a
    add(level(2), radial(120)), // 3b
    add(level(2), radial(240)), // 3c
    level(3), // contact 8 (top ring)
  ].map(round3);
  return { head: round3(head), tail: round3(level(3)), contacts };
};

// Deliberately oblique trajectories (not axis-aligned) near the STN targets.
const right = buildSide([12.4, -13.2, -9.3], [0.3, 0.4, 0.87]);
const left = buildSide([-12.4, -13.2, -9.3], [-0.3, 0.4, 0.87]);

const reconstruction = {
  elmodel: 'Boston Scientific Vercise Directed',
  props: [
    { elmodel: 'Boston Scientific Vercise Directed', manually_corrected: 1 },
    { elmodel: 'Boston Scientific Vercise Directed', manually_corrected: 1 },
  ],
  coords_right: right.contacts,
  coords_left: left.contacts,
  markers: {
    head1: right.head,
    tail1: right.tail,
    head2: left.head,
    tail2: left.tail,
  },
  directionality: { roll_out_right: 120, roll_out_left: 60 },
  mni: {
    coords_mm: [right.contacts, left.contacts],
    markers: [
      { head: right.head, tail: right.tail },
      { head: left.head, tail: left.tail },
    ],
  },
};

// ---------- stimulation parameters (S struct, matches initializeS shape) ----------
const makeSource = (activeContacts = {}) => {
  const source = { case: { perc: 100, pol: 2 }, amp: 0, va: 2, pulseWidth: 60 };
  for (let k = 1; k <= 8; k += 1) {
    source[`k${k}`] = { perc: 0, pol: 0, imp: 1 };
  }
  Object.entries(activeContacts).forEach(([k, perc]) => {
    source[k] = { perc, pol: 1, imp: 1 };
  });
  return source;
};

const S = { label: SESSION };
for (let i = 1; i <= 4; i += 1) {
  S[`Rs${i}`] = makeSource();
  S[`Ls${i}`] = makeSource();
}
// Right: contact 2a cathode, 2.5 mA. Left: contacts 3a+3b split cathodes, 1.8 mA.
S.Rs1 = makeSource({ k2: 100 });
S.Rs1.amp = 2.5;
S.Ls1 = makeSource({ k5: 60, k6: 40 });
S.Ls1.amp = 1.8;
S.active = [1, 1];
S.model = 'SimBio/FieldTrip (see Horn 2017)';
S.monopolarmodel = 0;
S.amplitude = [
  [2.5, 0, 0, 0],
  [1.8, 0, 0, 0],
];
S.numContacts = 8;
S.sources = [1, 2, 3, 4];
S.volume = [];
S.ver = '2.0';

// ---------- anatomy PLY: two STN-ish ellipsoids ----------
const buildEllipsoid = (center, semi, yawDeg, color, rings = 24, segs = 32) => {
  const yaw = (yawDeg * Math.PI) / 180;
  const vertices = [];
  const faces = [];
  for (let r = 0; r <= rings; r += 1) {
    const phi = (r / rings) * Math.PI;
    for (let s = 0; s <= segs; s += 1) {
      const theta = (s / segs) * 2 * Math.PI;
      let x = semi[0] * Math.sin(phi) * Math.cos(theta);
      let y = semi[1] * Math.sin(phi) * Math.sin(theta);
      const z = semi[2] * Math.cos(phi);
      const xr = x * Math.cos(yaw) - y * Math.sin(yaw);
      const yr = x * Math.sin(yaw) + y * Math.cos(yaw);
      vertices.push([center[0] + xr, center[1] + yr, center[2] + z]);
    }
  }
  const cols = segs + 1;
  for (let r = 0; r < rings; r += 1) {
    for (let s = 0; s < segs; s += 1) {
      const a = r * cols + s;
      const b = a + cols;
      faces.push([a, b, a + 1]);
      faces.push([a + 1, b, b + 1]);
    }
  }
  return { vertices, faces, color };
};

const blobs = [
  buildEllipsoid([11.8, -13.5, -8.2], [3.2, 4.6, 2.8], 25, [235, 150, 70]),
  buildEllipsoid([-11.8, -13.5, -8.2], [3.2, 4.6, 2.8], -25, [235, 150, 70]),
];

const writePly = (filePath) => {
  const totalVertices = blobs.reduce((n, b) => n + b.vertices.length, 0);
  const totalFaces = blobs.reduce((n, b) => n + b.faces.length, 0);
  const lines = [
    'ply',
    'format ascii 1.0',
    'comment fake anatomy (bilateral STN-like ellipsoids)',
    `element vertex ${totalVertices}`,
    'property float x',
    'property float y',
    'property float z',
    'property uchar red',
    'property uchar green',
    'property uchar blue',
    `element face ${totalFaces}`,
    'property list uchar int vertex_indices',
    'end_header',
  ];
  blobs.forEach((blob) => {
    blob.vertices.forEach((vtx) => {
      lines.push(
        `${vtx.map((x) => x.toFixed(3)).join(' ')} ${blob.color.join(' ')}`,
      );
    });
  });
  let offset = 0;
  blobs.forEach((blob) => {
    blob.faces.forEach((f) => {
      lines.push(`3 ${f[0] + offset} ${f[1] + offset} ${f[2] + offset}`);
    });
    offset += blob.vertices.length;
  });
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
};

// ---------- NIfTI-1 binary mask overlays (deliberately blocky at 0.75mm) ----------
const writeNifti = (filePath, center, semi, yawDeg) => {
  const dim = [32, 32, 32];
  const vox = 0.75;
  const origin = center.map((c, i) => c - (dim[i] / 2) * vox);
  const yaw = (yawDeg * Math.PI) / 180;
  const data = Buffer.alloc(dim[0] * dim[1] * dim[2]);
  for (let z = 0; z < dim[2]; z += 1) {
    for (let y = 0; y < dim[1]; y += 1) {
      for (let x = 0; x < dim[0]; x += 1) {
        const wx = origin[0] + (x + 0.5) * vox - center[0];
        const wy = origin[1] + (y + 0.5) * vox - center[1];
        const wz = origin[2] + (z + 0.5) * vox - center[2];
        const rx = wx * Math.cos(-yaw) - wy * Math.sin(-yaw);
        const ry = wx * Math.sin(-yaw) + wy * Math.cos(-yaw);
        const d =
          (rx / semi[0]) ** 2 + (ry / semi[1]) ** 2 + (wz / semi[2]) ** 2;
        if (d <= 1) data[x + dim[0] * (y + dim[1] * z)] = 1;
      }
    }
  }

  const header = Buffer.alloc(352);
  header.writeInt32LE(348, 0); // sizeof_hdr
  header.writeInt16LE(3, 40); // dim[0] = number of dimensions
  header.writeInt16LE(dim[0], 42);
  header.writeInt16LE(dim[1], 44);
  header.writeInt16LE(dim[2], 46);
  header.writeInt16LE(1, 48);
  header.writeInt16LE(1, 50);
  header.writeInt16LE(1, 52);
  header.writeInt16LE(1, 54);
  header.writeInt16LE(2, 70); // datatype = uint8
  header.writeInt16LE(8, 72); // bitpix
  header.writeFloatLE(1, 76); // pixdim[0]
  header.writeFloatLE(vox, 80);
  header.writeFloatLE(vox, 84);
  header.writeFloatLE(vox, 88);
  header.writeFloatLE(352, 108); // vox_offset
  header.writeFloatLE(1, 112); // scl_slope
  header.writeFloatLE(0, 116); // scl_inter
  header.writeInt16LE(0, 252); // qform_code
  header.writeInt16LE(1, 254); // sform_code = scanner
  // srow_x/y/z: voxel-to-mm affine
  header.writeFloatLE(vox, 280);
  header.writeFloatLE(0, 284);
  header.writeFloatLE(0, 288);
  header.writeFloatLE(origin[0], 292);
  header.writeFloatLE(0, 296);
  header.writeFloatLE(vox, 300);
  header.writeFloatLE(0, 304);
  header.writeFloatLE(origin[1], 308);
  header.writeFloatLE(0, 312);
  header.writeFloatLE(0, 316);
  header.writeFloatLE(vox, 320);
  header.writeFloatLE(origin[2], 324);
  header.write('n+1\0', 344, 4, 'binary'); // magic
  fs.writeFileSync(filePath, zlib.gzipSync(Buffer.concat([header, data])));
};

// ---------- write the dataset ----------
const patientDir = path.join(ROOT, 'derivatives', 'leaddbs', PATIENT);
const clinicalDir = path.join(patientDir, 'clinical');
const sessionDir = path.join(clinicalDir, `ses-${SESSION}`);
const plyDir = path.join(patientDir, 'export', 'ply');
const overlaysDir = path.join(ROOT, 'test_overlays');
[sessionDir, plyDir, overlaysDir].forEach((dir) =>
  fs.mkdirSync(dir, { recursive: true }),
);

fs.writeFileSync(
  path.join(ROOT, 'dataset_description.json'),
  JSON.stringify(
    { Name: 'Fake DBS Dataset (synthetic test data)', BIDSVersion: '1.8.0' },
    null,
    2,
  ),
);
fs.writeFileSync(
  path.join(ROOT, 'patient_info.json'),
  JSON.stringify(
    { name: 'Fake Patient 01', elmodel: 'Boston Scientific Vercise Directed' },
    null,
    2,
  ),
);
fs.writeFileSync(
  path.join(clinicalDir, `${PATIENT}_desc-reconstruction.json`),
  JSON.stringify(reconstruction, null, 2),
);
fs.writeFileSync(
  path.join(sessionDir, `${PATIENT}_ses-${SESSION}_stimparameters.json`),
  JSON.stringify({ S }, null, 2),
);
writePly(path.join(plyDir, 'anatomy.ply'));
writeNifti(
  path.join(overlaysDir, 'fake_stn_right.nii.gz'),
  [11.8, -13.5, -8.2],
  [3.2, 4.6, 2.8],
  25,
);
writeNifti(
  path.join(overlaysDir, 'fake_stn_left.nii.gz'),
  [-11.8, -13.5, -8.2],
  [3.2, 4.6, 2.8],
  -25,
);

console.log('Fake dataset written to', ROOT);
