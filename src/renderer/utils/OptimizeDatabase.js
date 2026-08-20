// import THREE from 'three';
// import { optimizeSphereValues } from './StimOptimizer';
// const {initializeS} = require('./InitializeS');
// import initializeS from './InitializeS';

const THREE = require('three');
const math = require('mathjs');
const { optimizeSphereValues, projectNumContacts } = require('../components/stimulation/StimOptimizer');

const initializeS = (label, numContacts) => {
  const S = {};

  // Assign label
  S.label = Array.isArray(label) ? label[0] : label;

  // Initialize right sources
  for (let source = 1; source <= 4; source++) {
    S[`Rs${source}`] = { case: {}, amp: 0, va: 2, pulseWidth: 60 };
    for (let k = 1; k <= numContacts; k++) {
      S[`Rs${source}`][`k${k}`] = { perc: 0, pol: 0, imp: 1 };
    }
    S[`Rs${source}`].case.perc = 100;
    S[`Rs${source}`].case.pol = 2;
  }

  // Initialize left sources
  for (let source = 1; source <= 4; source++) {
    S[`Ls${source}`] = { case: {}, amp: 0, va: 2, pulseWidth: 60 };
    for (let k = 1; k <= numContacts; k++) {
      S[`Ls${source}`][`k${k}`] = { perc: 0, pol: 0, imp: 1 };
    }
    S[`Ls${source}`].case.perc = 100;
    S[`Ls${source}`].case.pol = 2;
  }

  // Assign additional properties
  S.active = [1, 1];
  S.model = 'SimBio/FieldTrip (see Horn 2017)';
  S.monopolarmodel = 0;
  S.amplitude = [Array(4).fill(0), Array(4).fill(0)];
  S.numContacts = numContacts;
  S.sources = [1, 2, 3, 4];
  S.volume = [];
  S.ver = '2.0';

  return S;
}

const varargout = [
  { displayName: 'Medtronic 3389', value: 'medtronic_3389' },
  { displayName: 'Medtronic 3387', value: 'medtronic_3387' },
  { displayName: 'Medtronic 3391', value: 'medtronic_3391' },
  { displayName: 'Medtronic B33005', value: 'medtronic_b33005' },
  { displayName: 'Medtronic B33015', value: 'medtronic_b33015' },
  { displayName: 'Boston Scientific Vercise', value: 'boston_vercise' },
  {
    displayName: 'Boston Scientific Vercise Directed',
    value: 'boston_vercise_directed',
  },
  // {
  //   displayName: 'Boston Scientific Vercise Cartesia HX',
  //   value: 'boston_vercise_cartesia_hx',
  // },
  // {
  //   displayName: 'Boston Scientific Vercise Cartesia X',
  //   value: 'boston_vercise_cartesia_x',
  // },
  {
    displayName: 'Abbott ActiveTip (6146-6149)',
    value: 'abbott_activetip_2mm',
  },
  {
    displayName: 'Abbott ActiveTip (6142-6145)',
    value: 'abbott_activetip_3mm',
  },
  {
    displayName: 'Abbott Directed 6172 (short)',
    value: 'abbott_directed_05',
  },
  { displayName: 'Abbott Directed 6173 (long)', value: 'abbott_directed_15' },
  { displayName: 'PINS Medical L301', value: 'pins_l301' },
  { displayName: 'PINS Medical L302', value: 'pins_l302' },
  { displayName: 'PINS Medical L303', value: 'pins_l303' },
  { displayName: 'SceneRay SR1200', value: 'sceneray_sr1200' },
  { displayName: 'SceneRay SR1210', value: 'sceneray_sr1210' },
  { displayName: 'SceneRay SR1211', value: 'sceneray_sr1211' },
  { displayName: 'SceneRay SR1242', value: 'sceneray_sr1242' },
  { displayName: 'SDE-08 S8 Legacy', value: 'sde_08_s8_legacy' },
  { displayName: 'SDE-08 S10 Legacy', value: 'sde_08_s10_legacy' },
  { displayName: 'SDE-08 S12 Legacy', value: 'sde_08_s12_legacy' },
  { displayName: 'SDE-08 S16 Legacy', value: 'sde_08_s16_legacy' },
  { displayName: 'SDE-08 S8', value: 'sde_08_s8' },
  { displayName: 'SDE-08 S10', value: 'sde_08_s10' },
  { displayName: 'SDE-08 S12', value: 'sde_08_s12' },
  { displayName: 'SDE-08 S14', value: 'sde_08_s14' },
  { displayName: 'SDE-08 S16', value: 'sde_08_s16' },
  { displayName: 'PMT 2102-04-091', value: 'pmt_2102_04_091' },
  { displayName: 'PMT 2102-06-091', value: 'pmt_2102_06_091' },
  { displayName: 'PMT 2102-08-091', value: 'pmt_2102_08_091' },
  { displayName: 'PMT 2102-10-091', value: 'pmt_2102_10_091' },
  { displayName: 'PMT 2102-12-091', value: 'pmt_2102_12_091' },
  { displayName: 'PMT 2102-14-091', value: 'pmt_2102_14_091' },
  { displayName: 'PMT 2102-16-091', value: 'pmt_2102_16_091' },
  { displayName: 'PMT 2102-16-092', value: 'pmt_2102_16_092' },
  { displayName: 'PMT 2102-16-093', value: 'pmt_2102_16_093' },
  { displayName: 'PMT 2102-16-131', value: 'pmt_2102_16_131' },
  { displayName: 'PMT 2102-16-142', value: 'pmt_2102_16_142' },
  { displayName: '2069-EPC-05C-35', value: 'epc_05c' },
  { displayName: '2069-EPC-15C-35', value: 'epc_15c' },
  { displayName: 'NeuroPace DL-344-3.5', value: 'neuropace_dl_344_35' },
  { displayName: 'NeuroPace DL-344-10', value: 'neuropace_dl_344_10' },
  { displayName: 'DIXI D08-05AM', value: 'dixi_d08_05am' },
  { displayName: 'DIXI D08-08AM', value: 'dixi_d08_08am' },
  { displayName: 'DIXI D08-10AM', value: 'dixi_d08_10am' },
  { displayName: 'DIXI D08-12AM', value: 'dixi_d08_12am' },
  { displayName: 'DIXI D08-15AM', value: 'dixi_d08_15am' },
  { displayName: 'DIXI D08-18AM', value: 'dixi_d08_18am' },
  { displayName: 'AdTech BF08R-SP05X', value: 'adtech_bf08r_sp05x' },
  { displayName: 'AdTech BF08R-SP21X', value: 'adtech_bf08r_sp21x' },
  { displayName: 'AdTech BF08R-SP61X', value: 'adtech_bf08r_sp61x' },
  { displayName: 'AdTech BF09R-SP61X-0BB', value: 'adtech_bf09r_sp61x_0bb' },
  { displayName: 'AdTech RD06R-SP05X', value: 'adtech_rd06r_sp05x' },
  { displayName: 'AdTech RD08R-SP05X', value: 'adtech_rd08r_sp05x' },
  { displayName: 'AdTech RD10R-SP03X', value: 'adtech_rd10r_sp03x' },
  { displayName: 'AdTech RD10R-SP05X', value: 'adtech_rd10r_sp05x' },
  { displayName: 'AdTech RD10R-SP06X', value: 'adtech_rd10r_sp06x' },
  { displayName: 'AdTech RD10R-SP07X', value: 'adtech_rd10r_sp07x' },
  { displayName: 'AdTech RD10R-SP08X', value: 'adtech_rd10r_sp08x' },
  { displayName: 'AdTech SD06R-SP26X', value: 'adtech_sd06r_sp26x' },
  { displayName: 'AdTech SD08R-SP05X', value: 'adtech_sd08r_sp05x' },
  { displayName: 'AdTech SD10R-SP05X', value: 'adtech_sd10r_sp05x' },
  {
    displayName: 'AdTech SD10R-SP05X Choi',
    value: 'adtech_sd10r_sp05x_choi',
  },
  { displayName: 'AdTech SD14R-SP05X', value: 'adtech_sd14r_sp05x' },
  { displayName: 'ELAINE Rat Electrode', value: 'elaine_rat_electrode' },
  { displayName: 'FHC WU Rat Electrode', value: 'fhc_wu_rat_electrode' },
  { displayName: 'NuMed Mini Lead', value: 'numed_minilead' },
  {
    displayName: 'Aleva directSTIM Directed',
    value: 'aleva_directstim_directed',
  },
  { displayName: 'Aleva directSTIM 11500', value: 'aleva_directstim_11500' },
  {
    displayName: 'SmartFlow Cannula NGS-NC-06',
    value: 'smartflow_ngs_nc_06',
  },
];

const handleImportedElectrode = (importedElectrode) => {
  const electrodeInfo = varargout.find(
    (item) => item.displayName === importedElectrode,
  );
  return electrodeInfo ? electrodeInfo.value : 'boston_vercise_directed';
};

const initializeVariables = (elspec) => {
  let contactDirections = {
    1: { x: 0, y: 0, z: 0 },
    2: { x: 0, y: 0, z: 0 },
    3: { x: 0, y: 0, z: 0 },
    4: { x: 0, y: 0, z: 0 },
  };
  let keyLevels = {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
  };
  if (elspec.numel > 6) {
    // contactDirections = {
    //   1: { x: 0, y: 0, z: 0 }, // Example directional adjustment for contact 1
    //   2: { x: 1, y: 0, z: 0 }, // Contact 2 adjustment
    //   3: { x: -0.5, y: -0.86, z: 0 }, // Contact 3 adjustment
    //   4: { x: -0.5, y: 0.86, z: 0 }, // Contact 4 adjustment
    //   5: { x: 1, y: 0, z: 0 }, // Contact 5 adjustment
    //   6: { x: -0.5, y: -0.86, z: 0 }, // Contact 6 adjustment
    //   7: { x: -0.5, y: 0.86, z: 0 }, // Contact 7 adjustment
    //   8: { x: 0, y: 0, z: 0 }, // Contact 8 adjustment
    // };
    contactDirections = {
      1: { x: 0, y: 0, z: 0 }, // Example directional adjustment for contact 1
      2: { x: 1, y: 0, z: 0 }, // Contact 2 adjustment
      3: { x: -0.5, y: -0.86, z: 0 }, // Contact 3 adjustment
      4: { x: -0.5, y: 0.86, z: 0 }, // Contact 4 adjustment
      5: { x: 1, y: 0, z: 0 }, // Contact 5 adjustment
      6: { x: -0.5, y: -0.86, z: 0 }, // Contact 6 adjustment
      7: { x: -0.5, y: 0.86, z: 0 }, // Contact 7 adjustment
      8: { x: 0, y: 0, z: 0 }, // Contact 8 adjustment
    };
    keyLevels = {
      1: 1,
      2: 2,
      3: 2,
      4: 2,
      5: 3,
      6: 3,
      7: 3,
      8: 4,
    };
  }

  const quantities = {};
  for (let i = 0; i <= elspec.numel; i++) {
    quantities[i] = 0;
  }

  return { quantities, contactDirections, keyLevels };
};

const findClusters = (coordinates, epsilon) => {
  // Step 1: Filter for positive points
  const positivePoints = coordinates.filter(([x, y, z, r]) => r > 0);

  // Step 2: Helper to calculate Euclidean distance
  const calculateDistance = ([x1, y1, z1], [x2, y2, z2]) =>
    math.sqrt(
      math.pow(x1 - x2, 2) + math.pow(y1 - y2, 2) + math.pow(z1 - z2, 2),
    );

  // Step 3: Clustering algorithm
  const clusters = [];
  const visited = new Set();

  const growCluster = (startIndex) => {
    const cluster = [];
    const queue = [startIndex];

    while (queue.length > 0) {
      const currentIndex = queue.pop();
      if (visited.has(currentIndex)) continue;

      visited.add(currentIndex);
      const currentPoint = positivePoints[currentIndex];
      cluster.push(currentPoint);

      // Find neighbors within epsilon distance
      positivePoints.forEach((point, index) => {
        if (!visited.has(index)) {
          const distance = calculateDistance(
            currentPoint.slice(0, 3),
            point.slice(0, 3),
          );
          if (distance <= epsilon) {
            queue.push(index);
          }
        }
      });
    }

    return cluster;
  };

  // Step 4: Iterate through all points to form clusters
  positivePoints.forEach((point, index) => {
    if (!visited.has(index)) {
      const newCluster = growCluster(index);
      clusters.push(newCluster);
    }
  });

  // Step 5: Find the largest cluster
  const largestCluster = clusters.reduce(
    (largest, cluster) =>
      cluster.length > largest.length ? cluster : largest,
    [],
  );

  // Step 6: Compute averages for the largest cluster
  const total = largestCluster.reduce(
    (acc, [x, y, z, r]) => {
      acc.x += x;
      acc.y += y;
      acc.z += z;
      acc.r += r;
      return acc;
    },
    { x: 0, y: 0, z: 0, r: 0 },
  );

  const numPoints = largestCluster.length;

  const average = {
    x: total.x / numPoints,
    y: total.y / numPoints,
    z: total.z / numPoints,
    r: total.r / numPoints,
  };

  return {
    average,
    points: largestCluster, // The points in the largest cluster
  };
};

const filterBoxAroundSphere = (L, sphereCoords, boxSize, sphereIndex) => {
  // Extract the center of the box from the third sphere coordinate
  const [cx, cy, cz] = sphereCoords[sphereIndex];
  console.log(cx, cy, cz);
  console.log(L);
  // Define the half-size of the box (since the box is symmetric around the center)
  const halfBox = boxSize / 2;

  // Filter L based on the box boundaries
  const filteredL = L.filter(
    ([x, y, z]) =>
      x >= cx - halfBox &&
      x <= cx + halfBox &&
      y >= cy - halfBox &&
      y <= cy + halfBox &&
      z >= cz - halfBox &&
      z <= cz + halfBox,
  );

  console.log(`Filtered L size: ${filteredL.length}`);
  const epsilon = 2;
  const clusters = findClusters(filteredL, epsilon);
  console.log('Positive clusters: ', clusters);
  return { filteredL, clusters };
};

const calculateElectrodeCoordinates = (
  quantities,
  contactDirections,
  keyLevels,
  side,
  recoData,
  togglePosition,
) => {
  const newCoords = [];

  let rotationAngle = 0;
  if (side < 5 && Object.keys(quantities).length > 6) {
    rotationAngle = recoData.directionality.roll_out_left - 60;
  } else {
    rotationAngle = recoData.directionality.roll_out_right - 120;
  }
  const rotationQuaternion = new THREE.Quaternion();
  rotationQuaternion.setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    THREE.MathUtils.degToRad(rotationAngle),
  ); // Z-axis rotation

  Object.keys(contactDirections).forEach((contactId) => {
    console.log(togglePosition);
    let contactQuantity = parseFloat(quantities[contactId]);
    const vectorLevel = keyLevels[contactId];
    const clampedLevel = Math.min(Math.max(vectorLevel, 1), 4);
    const normalizedLevel = (clampedLevel - 1) / (4 - 1);

    let startCoords = [];
    let targetCoords = [];
    if (side < 5) {
      const { head2: headMarkers, tail2: tailMarkers } = recoData.markers;
      startCoords = new THREE.Vector3(...headMarkers);
      targetCoords = new THREE.Vector3(...tailMarkers);
    } else {
      const { head1: headMarkers, tail1: tailMarkers } = recoData.markers;
      startCoords = new THREE.Vector3(...headMarkers);
      targetCoords = new THREE.Vector3(...tailMarkers);
    }

    // Calculate the direction of the electrode
    const direction = new THREE.Vector3()
      .subVectors(targetCoords, startCoords)
      .normalize();

    // Create an orthogonal basis for the electrode
    const up = new THREE.Vector3(0, 0, 1); // Assuming 'up' is along the global Z-axis
    const right = new THREE.Vector3().crossVectors(direction, up).normalize();
    const forward = new THREE.Vector3()
      .crossVectors(right, direction)
      .normalize();

    // Linearly interpolate between startCoords and targetCoords based on normalizedLevel
    const newPosition = startCoords.clone().lerp(targetCoords, normalizedLevel);

    // Get the direction adjustment for the contact
    // const directionOffset = contactDirections[contactId];

    // Get the direction offset for the contact
    const directionOffset = new THREE.Vector3(
      contactDirections[contactId].x,
      contactDirections[contactId].y,
      contactDirections[contactId].z,
    );

    // Apply the rotation to the directionOffset using the quaternion
    directionOffset.applyQuaternion(rotationQuaternion);

    // Apply the direction offset to the newPosition relative to the electrode’s orientation
    newPosition.x +=
      right.x * directionOffset.x +
      forward.x * directionOffset.y +
      direction.x * directionOffset.z;
    newPosition.y +=
      right.y * directionOffset.x +
      forward.y * directionOffset.y +
      direction.y * directionOffset.z;
    newPosition.z +=
      right.z * directionOffset.x +
      forward.z * directionOffset.y +
      direction.z * directionOffset.z;

    newCoords.push([newPosition.x, newPosition.y, newPosition.z]);
  });

  console.log('NewCoords: ', newCoords);
  return newCoords;
};

const findNearestCoordinate = (target, coordinates) => {
  const [x1, y1, z1] = target;
  let minIndex = -1;
  let minDistance = Infinity;
  const coordinateDistances = coordinates.map(([x2, y2, z2], index) => {
    const distance = Math.sqrt(
      (x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2,
    );
    if (distance < minDistance) {
      minDistance = distance;
      minIndex = index;
    }
    return { index, distance };
  });

  // Sort distances to assign ranks
  const rankedDistances = [...coordinateDistances]
    .sort((a, b) => a.distance - b.distance)
    .map((item, rank) => ({ ...item, rank: rank + 1 })); // Rank starts from 1

  return {
    index: minIndex,
    distance: minDistance,
    distanceArray: rankedDistances, // Array with distances and ranks
  };
};

const calculateAmplitude = (distance, k = 0.22) => {
  const tmpAmp = k * distance ** 2 + 0.1;
  return Math.round(tmpAmp * 10) / 10;
};

const cylinderSurfaceArea = (
  elspec
) => {
  const diameter = elspec.contact_diameter / 1000,
  const height = elspec.contact_length / 1000,
  const n_contacts = 1,
  const radius = diameter / 2;
  const contact_area = 2 * Math.PI * radius * height;
  const directional_area = contact_area / n_contacts;
  return directional_area;
};

const getCharge = (current, pulseWidth = 30) => {
  const currentInAmps = current * 1e-3;
  // Calculate charge (Q) in coulombs (C)
  const chargeInCoulombs = currentInAmps * pulseWidth * 1e-6;
  // Convert charge to microcoulombs (µC)
  const chargeInMicroCoulombs = chargeInCoulombs * 1e6;
  return chargeInMicroCoulombs;
};

const isSafeCharge = (Q, A, D, k = 1.5) => {
  const maxSafeCharge = A * 10 ** (k - Math.log10(D));
  // Check if the given charge per phase is below the safe threshold
  console.log('Q: ', Q);
  console.log('Max safe charge: ', maxSafeCharge);
  const isSafe = Q < maxSafeCharge;
  // Return both the boolean result and the max safe charge
  return { isSafe, maxSafeCharge };
};

const calculateAmps = (charge, pulsewidth) => {
  const chargeInCoulombs = charge * 1e-6;
  // Calculate current (I) in amps (A)
  const currentInAmps = (1e-6 * pulsewidth) / chargeInCoulombs;
  // Convert current to microamps (µA)
  const currentInMilliAmps = currentInAmps * 1e-6;
  return Math.round(currentInMilliAmps * 10) / 10;
};

const handleSafety = (amp, elspec) => {
  const contactSurfaceArea = cylinderSurfaceArea(elspec);
  const charge = getCharge(amp);
  const { isSafe, maxSafeCharge } = isSafeCharge(
    charge,
    contactSurfaceArea,
    30,
  );
  let newAmplitude = amp;
  console.log(isSafe);
  console.log(maxSafeCharge);
  if (!isSafe) {
    newAmplitude = calculateAmps(maxSafeCharge, 30);
  }
  return newAmplitude;
};

const handleNiiMap = (elecCoords, importedCoords, elspec) => {
  const sphereCoords = elecCoords;
  console.log(elecCoords);
  // const v = [0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75];
  const v =
    elspec.numel === 8
      ? [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
      : [1, 1, 1, 1];
  // const v = [1, 1, 1, 1];
  // const L = niiCoords;
  const L = importedCoords;
  const { filteredL, clusters } = filterBoxAroundSphere(
    L,
    sphereCoords,
    20,
    2,
  );
  const reducedL = filteredL;
  // const reducedL = L;
  const normalizedPlotNiiCoords = reducedL.map(([x, y, z, r]) => {
    // Apply arctan normalization
    const normalizedR = Math.atan(r); // Normalize arctan(r) to [0, 1]
    // Return the updated coordinate array with normalized R
    return [x, y, z, normalizedR];
  });

  const normalizedTestCoords = L.map(([x, y, z, r]) => {
    // Apply arctan normalization
    const normalizedR = Math.atan(r); // Normalize arctan(r) to [0, 1]
    // Return the updated coordinate array with normalized R
    return [x, y, z, normalizedR];
  });
  console.log(normalizedPlotNiiCoords);
  const sweetspotCoord = [
    clusters.average.x,
    clusters.average.y,
    clusters.average.z,
  ];
  const coordinateOutput = findNearestCoordinate(
    sweetspotCoord,
    sphereCoords,
  );
  const activeContact = coordinateOutput.index;
  const activeAmplitude = calculateAmplitude(coordinateOutput.distance);
  console.log(coordinateOutput.distanceArray);
  console.log(activeAmplitude);
  console.log(activeContact);
  let finalAmplitude = activeAmplitude;
  if (activeAmplitude > 5) {
    finalAmplitude = handleSafety(activeAmplitude, elspec);
  }
  console.log(finalAmplitude);
  if (finalAmplitude >= 4) {
    finalAmplitude = 3;
  }
  const totalAmplitude = 3.9; // Total amplitude to distribute
  const remainingAmplitude = totalAmplitude - finalAmplitude;

  // Number of indices to split the remaining amplitude across
  const otherContacts = v.length - 1;

  // Distribute remaining amplitude equally
  const equalAmplitude = remainingAmplitude / otherContacts;

  // Update the array
  const updatedV = v.map((value, index) =>
    index === activeContact ? finalAmplitude : equalAmplitude,
  );
  console.log(updatedV);
  // setPlotNiiCoords(L);

  const outputV = optimizeSphereValues(
    sphereCoords,
    updatedV,
    normalizedPlotNiiCoords,
    // normalizedTestCoords,
  );
  // const newOutputV = projectNumContacts(
  //   sphereCoords,
  //   outputV,
  //   2,
  //   normalizedPlotNiiCoords,
  // );
  // console.log(newOutputV);
  return outputV;
  // setNiiSolution(outputV);
};

const handleOptimizeDatabase = (fileData, elspec, niiCoords) => {
  console.log('Optimizing database');
  console.log(elspec);
  const recoData = fileData;
  const patientParameters = {};
  const sides = [1, 10];
  // const side = 1;
  const togglePosition = 'left';
  const { quantities, contactDirections, keyLevels } =
    initializeVariables(elspec);
  sides.forEach((side) => {
    const contactCoords = calculateElectrodeCoordinates(
      quantities,
      contactDirections,
      keyLevels,
      side,
      recoData,
      togglePosition,
    );
    patientParameters[side] = handleNiiMap(contactCoords, niiCoords, elspec);
  })
  return patientParameters;

};

const restructureParameters = (patientParameters) => {
  const restructuredParameters = {};
  Object.keys(patientParameters).forEach((key) => {
    console.log(patientParameters[key]);
    const tempS = initializeS(patientParameters[key], patientParameters[key][1].length);
    console.log('tempS: ', tempS);
    let leftSum = 0;
    let rightSum = 0;
    // let leftS = tempS;
    // let rightS = tempS;
    if (!restructuredParameters[key]) {
      restructuredParameters[key] = {};
    }
    Object.keys(patientParameters[key][1]).forEach((contact) => {
      let contactValue = patientParameters[key][1][contact];
      if (contactValue < 0.2) {
        contactValue = 0;
      }
      leftSum += contactValue;
    })
    Object.keys(patientParameters[key][10]).forEach((contact) => {
      let contactValue = patientParameters[key][10][contact];
      if (contactValue < 0.2) {
        contactValue = 0;
      }
      rightSum += contactValue;
    })

    Object.keys(patientParameters[key][1]).forEach((contact) => {
      let contactValue = patientParameters[key][1][contact];
      if (contactValue < 0.2) {
        contactValue = 0;
      } else {
        try {
          tempS['Ls1'][`k${parseFloat(contact) + 1}`].perc = (contactValue / leftSum) * 100;
          tempS['Ls1'][`k${parseFloat(contact) + 1}`].pol = 1;
        } catch (error) {
          console.log('Error: ', error);
          // console.log(tempS['Rs1'][`k${contact}`]);
          console.log(contactValue);
          console.log(`k${parseFloat(contact) + 1}`);
          console.log(tempS['Ls1']);
          console.log(tempS['Ls1'][`k${parseFloat(contact) + 1}`]);
        }
      }
    })
    tempS.amplitude[1][0] = Math.round(leftSum * 100) / 100;
    tempS['Ls1'].amp = Math.round(leftSum * 100) / 100;
    // restructuredParameters[key]['L'] = tempS;

    Object.keys(patientParameters[key][10]).forEach((contact) => {
      let contactValue = patientParameters[key][10][contact];
      if (contactValue < 0.2) {
        contactValue = 0;
      } else {
        try {
          tempS['Rs1'][`k${parseFloat(contact) + 1}`].perc = (contactValue / rightSum) * 100;
          tempS['Rs1'][`k${parseFloat(contact) + 1}`].pol = 1;
        } catch (error) {
          console.log('Error: ', error);
          // console.log(tempS['Rs1'][`k${contact}`]);
          console.log(contactValue);
          console.log(`k${parseFloat(contact) + 1}`);
        }
      }
    })
    tempS.amplitude[0][0] = Math.round(rightSum * 100) / 100;
    tempS['Rs1'].amp = Math.round(rightSum * 100) / 100;
    restructuredParameters[key].S = tempS;
  })
  return restructuredParameters;
}

const optimizeDatabase = async (patients, directoryPath, electrodeModels, niiCoords) => {
  console.log(patients);
  const timeline = 'temp';
  const leadDBS = true;
  const patientCoords = {};
  const patientParameters = {};
  let outputGroupParameters = {};
  // const loadPatientCoords = async () => {
  //   Object.keys(patients).forEach((patient) => {
  //     const historical = {
  //       patient: patients[patient],
  //       timeline,
  //       directoryPath,
  //       leadDBS,
  //     };
  //     console.log(historical);
  //     try {
  //       const fileData = window.electron.ipcRenderer
  //         .invoke('load-vis-coords', historical)
  //         .then((fileData) => {
  //           console.log(fileData);
  //           patientCoords[patients[patient].id] = fileData;
  //           const electrodeModel = handleImportedElectrode(fileData.elmodel);
  //           patientParameters[patients[patient].id] = handleOptimizeDatabase(fileData, electrodeModels[electrodeModel], niiCoords);
  //           outputGroupParameters = patientParameters;
  //           console.log('Patient Parameters: ', patientParameters);
  //         })
  //         .catch((error) => {
  //           console.error('Error loading PLY file:', error);
  //         });
  //     } catch (error) {
  //       console.error('Error invoking load-vis-coords:', error);
  //     }
  //   });
  // };

  const loadPatientCoords = async () => {
    for (const patient of Object.keys(patients)) {
      const historical = {
        patient: patients[patient],
        timeline,
        directoryPath,
        leadDBS,
      };
      console.log(historical);
      try {
        const fileData = await window.electron.ipcRenderer.invoke('load-vis-coords', historical);
        console.log(fileData);
        patientCoords[patients[patient].id] = fileData;
        const electrodeModel = handleImportedElectrode(fileData.elmodel);
        patientParameters[patients[patient].id] = handleOptimizeDatabase(fileData, electrodeModels[electrodeModel], niiCoords);
        outputGroupParameters = patientParameters;
        console.log('Patient Parameters: ', patientParameters);
      } catch (error) {
        console.error('Error loading PLY file:', error);
      }
    }
    // const historical = {
    //   patient: patients[1],
    //   timeline,
    //   directoryPath,
    //   leadDBS,
    // };
    // const fileData = await window.electron.ipcRenderer.invoke('load-vis-coords', historical);
    // console.log(fileData);
    // patientCoords[patients[1].id] = fileData;
    // const electrodeModel = handleImportedElectrode(fileData.elmodel);
    // patientParameters[patients[1].id] = handleOptimizeDatabase(fileData, electrodeModels[electrodeModel], niiCoords);
    // outputGroupParameters = patientParameters;

  };

  await loadPatientCoords();
  console.log(patientCoords);
  console.log(electrodeModels);
  console.log('Output Group Parameters: ', outputGroupParameters);
  const restructuredParameters = restructureParameters(outputGroupParameters);
  console.log('Restructured Parameters: ', restructuredParameters);
  window.electron.ipcRenderer.sendMessage('save-file-test', restructuredParameters);
};

module.exports = {
  optimizeDatabase,
  handleOptimizeDatabase,
};
