/**
 * PlyViewer Component
 *
 * This is a complex 3D visualization component that handles PLY file rendering,
 * NIfTI file processing, and 3D brain visualization. It provides tools for
 * electrode visualization, stimulation field modeling, and interactive 3D
 * manipulation of brain models and electrode data.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import * as THREE from 'three';
import { PLYLoader, OrbitControls } from 'three-stdlib';
import * as nifti from 'nifti-reader-js';
import { getTypedArray } from 'nifti-reader-js';
import * as iso from 'isosurface';
import ndarray from 'ndarray';

// UI Components
import {
  Tabs,
  Tab,
  Collapse,
  Button,
  Form,
  Modal,
  Dropdown,
  DropdownButton,
} from 'react-bootstrap';
import SettingsIcon from '@mui/icons-material/Settings';
import IconButton from '@mui/material/IconButton';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';

// Utilities
import * as math from 'mathjs';

// Local Components and Utils
import {
  optimizeSphereValues,
  projectNumContacts,
} from '../stimulation/StimOptimizer';
import { computeSuperimposedEField } from '../../utils/OssDbsStimsets';
import {
  nii2Mesh,
  processNifti,
  testPlane,
  addSliceToSceneNew,
} from '../../utils/NiftiUtils';
import {
  createFallbackElectrodeGeometry,
  extractFallbackElectrodeData,
  getFallbackElectrodeBounds,
  parseElectrodePlyGeometry,
} from '../../utils/electrodeFallbackGeometry';
import type { SteeringUnit } from '../../utils/currentSteering';
import { niftiValuesToViewerProgram } from '../../utils/viewerProgram';
import { createLeadAxisCameraPose } from '../../utils/leadAxisCamera';

// Type definitions
interface PlyViewerProps {
  quantities: Record<string, any>;
  selectedValues: Record<string, any>;
  amplitude: number;
  side: string;
  historical: any;
  steeringUnit: SteeringUnit;
  onProgramChange: (
    quantities: Record<string, number>,
    selectedValues: Record<string, string>,
    amplitude: number,
  ) => void;
  tab: string;
  names: string[];
  elspec: any;
}

type ElectrodeGeometryStatus = 'loading' | 'ply' | 'fallback' | 'empty';

const reconstructionWithCoordinateAliases = (value: unknown): any => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }
  const reconstruction = value as Record<string, any>;
  return {
    ...reconstruction,
    coords_right: reconstruction.coords_right ?? reconstruction.coords1,
    coords_left: reconstruction.coords_left ?? reconstruction.coords2,
  };
};

const disposeSceneObject = (object: THREE.Object3D) => {
  object.traverse((child: any) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material: THREE.Material) => material.dispose());
    } else {
      child.material?.dispose?.();
    }
  });
};

// Names used for the lead itself; these meshes cannot be removed/recolored
// from the mesh list because stimulation rendering depends on them.
const ELECTRODE_MESH_NAMES = new Set([
  'Electrode Scene',
  'Generic electrode model',
]);

// Distinguishable default colors assigned to dropped NIfTI overlays in order.
const OVERLAY_COLOR_PALETTE = [
  '#e05c4b',
  '#4b9fe0',
  '#57c46b',
  '#e0a54b',
  '#a06be0',
  '#4bd2c8',
  '#e05c9f',
  '#c8d24b',
];

const BACKGROUND_PRESETS = [
  { label: 'Black', value: '#000000' },
  { label: 'Charcoal', value: '#22272e' },
  { label: 'Slate', value: '#2c3e50' },
  { label: 'White', value: '#ffffff' },
];

// Standard anatomical camera directions in MNI-style coordinates
// (+x right, +y anterior, +z superior).
const VIEW_PRESETS = [
  { label: 'A', title: 'Anterior view', direction: [0, 1, 0], up: [0, 0, 1] },
  {
    label: 'P',
    title: 'Posterior view',
    direction: [0, -1, 0],
    up: [0, 0, 1],
  },
  { label: 'L', title: 'Left view', direction: [-1, 0, 0], up: [0, 0, 1] },
  { label: 'R', title: 'Right view', direction: [1, 0, 0], up: [0, 0, 1] },
  { label: 'S', title: 'Superior view', direction: [0, 0, 1], up: [0, 1, 0] },
  {
    label: 'I',
    title: 'Inferior view',
    direction: [0, 0, -1],
    up: [0, 1, 0],
  },
];

const NIFTI_FILE_PATTERN = /\.nii(\.gz)?$/i;

const stripNiftiExtension = (fileName: string): string =>
  fileName.replace(NIFTI_FILE_PATTERN, '');

const materialHexColor = (material: any): string | null => {
  if (!material || material.vertexColors || !material.color) return null;
  return `#${material.color.getHexString()}`;
};

function PlyViewer({
  quantities,
  selectedValues,
  amplitude,
  side,
  historical,
  steeringUnit,
  onProgramChange,
  tab,
  names,
  elspec,
}: PlyViewerProps) {
  const usesPhysicalQuantities = steeringUnit !== '%';
  const mountRef = useRef(null);
  const secondaryMountRef = useRef(null); // Ref for the secondary view
  const sphereRef = useRef(null); // Ref for the sphere to update position dynamically
  const controlsRef = useRef(null); // Ref for the OrbitControls
  const secondaryControlsRef = useRef(null); // Ref for the OrbitControls
  const [selectedTremor, setSelectedTremor] = useState([]); // Array to store selected tremor items
  const sphereRefs = useRef([]); // Refs for all spheres
  const sceneRef = useRef(null);
  const [atlas, setAtlas] = useState(null);
  const [meshes, setMeshes] = useState([]); // State to track meshes in the scene
  const [meshProperties, setMeshProperties] = useState({}); // State for each mesh's properties like visibility and opacity
  const rendererRef = useRef(null); // To store the renderer reference
  const secondaryRendererRef = useRef(null);
  const cameraRef = useRef(null); // To store the camera reference
  const secondaryCameraRef = useRef(null);
  const [open, setOpen] = useState(true);
  const [recoData, setRecoData] = useState(null);
  const [elecCoords, setElecCoords] = useState(null);
  const [roi, setRoi] = useState('tremor-0');
  const [avoidRoi, setAvoidRoi] = useState('tremor-0');
  const [niiCoords, setNiiCoords] = useState(null);
  const [plotNiiCoords, setPlotNiiCoords] = useState({});
  const [niiSolution, setNiiSolution] = useState('');
  const [slice, setSlice] = useState([]);
  const [sceneReady, setSceneReady] = useState(false);
  const [electrodeGeometryStatus, setElectrodeGeometryStatus] =
    useState<ElectrodeGeometryStatus>('loading');
  // Raw NIfTI buffers for imported overlays, kept so surfaces can be rebuilt
  // when the smoothing level changes. Keyed by mesh name.
  const niftiSourcesRef = useRef<Record<string, ArrayBuffer>>({});
  const overlayColorIndexRef = useRef(0);
  const [surfaceSmoothing, setSurfaceSmoothing] = useState(5);
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [importStatus, setImportStatus] = useState<{
    type: 'info' | 'error';
    message: string;
  } | null>(null);
  console.log('Historical ply: ', historical);
  // Thresholding/Modification stuff

  useEffect(() => {
    if (!sceneReady) return undefined;
    let cancelled = false;

    const loadElectrodeGeometry = async () => {
      setElectrodeGeometryStatus('loading');
      const [plyResult, reconstructionResult] = await Promise.allSettled([
        window.electron.ipcRenderer.invoke('load-ply-file', historical),
        window.electron.ipcRenderer.invoke('load-vis-coords', historical),
      ]);
      if (cancelled) return;

      const reconstruction =
        reconstructionResult.status === 'fulfilled'
          ? reconstructionWithCoordinateAliases(reconstructionResult.value)
          : null;
      setRecoData(reconstruction);

      if (plyResult.status === 'fulfilled' && plyResult.value) {
        try {
          const geometry = parseElectrodePlyGeometry(plyResult.value);
          const material = new THREE.MeshStandardMaterial({
            color: geometry.hasAttribute('color') ? 0xffffff : 0xbfc3c7,
            vertexColors: geometry.hasAttribute('color'),
            flatShading: false,
            roughness: 0.1,
            transparent: false,
            opacity: 1,
            emissive: new THREE.Color(0x333333),
            emissiveIntensity: 0.6,
          });
          // eslint-disable-next-line no-use-before-define
          addMeshToScene('Electrode Scene', geometry, material);
          setElectrodeGeometryStatus('ply');
          return;
        } catch (error) {
          console.warn(
            'The electrode PLY is invalid; using coordinates.',
            error,
          );
        }
      }

      const fallbackGeometry = createFallbackElectrodeGeometry(
        reconstruction,
        elspec,
      );
      if (fallbackGeometry) {
        const material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          flatShading: false,
          metalness: 0.25,
          roughness: 0.35,
          transparent: false,
          opacity: 1,
          emissive: new THREE.Color(0x222222),
          emissiveIntensity: 0.25,
        });
        // eslint-disable-next-line no-use-before-define
        addMeshToScene('Generic electrode model', fallbackGeometry, material);
        setElectrodeGeometryStatus('fallback');
        return;
      }

      setElectrodeGeometryStatus('empty');
    };

    loadElectrodeGeometry();
    return () => {
      cancelled = true;
    };
  }, [elspec, historical, sceneReady]);

  const convert_fox_to_mni = (coordinates, resolution = 2) => {
    const offset = [45, 63, 36];
    return coordinates.map(
      (value, index) => (value - offset[index]) * resolution,
    );
  };

  // Current working model
  // useEffect(() => {
  //   const loadNiftiFile = async () => {
  //     try {
  //       const fileData = await window.electron.ipcRenderer.invoke(
  //         'load-nii-file',
  //         historical,
  //       );

  //       // Validate if the file is a valid NIfTI file
  //       if (!nifti.isNIFTI(fileData)) {
  //         throw new Error('File is not a valid NIfTI file');
  //       }

  //       const header = nifti.readHeader(fileData);
  //       let image = nifti.readImage(header, fileData);

  //       // Ensure `image` is a valid ArrayBuffer
  //       if (!(image instanceof ArrayBuffer)) {
  //         console.log('Adjusting image to ArrayBuffer...');
  //         image = new Uint8Array(image).buffer;
  //       }

  //       // Handle endian mismatch
  //       if (!header.littleEndian) {
  //         console.warn('File is in big-endian format. Adjusting...');
  //         const dataView = new DataView(image);
  //         const correctedData = new Float32Array(image.byteLength / 4);
  //         for (let i = 0; i < correctedData.length; i++) {
  //           correctedData[i] = dataView.getFloat32(i * 4, false); // false = big-endian
  //         }
  //         image = correctedData;
  //       } else {
  //         image = new Float32Array(image);
  //       }

  //       // Apply scaling factors
  //       const { scl_slope = 1, scl_inter = 0 } = header;
  //       const img = new Float32Array(
  //         image.map((value) => value * scl_slope + scl_inter),
  //       );

  //       // Extract dimensions
  //       const dimensions = header.dims.slice(1, 4);
  //       console.log('Dimensions:', dimensions);

  //       // Generate voxel coordinates
  //       const voxelCoordinates = [];
  //       img.forEach((value, index) => {
  //         if (!isNaN(value)) {
  //           const z = Math.floor(index / (dimensions[0] * dimensions[1]));
  //           const y = Math.floor(
  //             (index % (dimensions[0] * dimensions[1])) / dimensions[0],
  //           );
  //           const x = index % dimensions[0];
  //           voxelCoordinates.push([x, y, z, value]);
  //         }
  //       });

  //       console.log('Voxel Coordinates:', voxelCoordinates);

  //       // Transform to MNI coordinates using affine matrix
  //       const affineMatrix = header.affine;
  //       const mniCoordinates = voxelCoordinates.map(([x, y, z, value]) => {
  //         const voxelHomogeneous = [x, y, z, 1]; // Add 1 for homogeneous transformation
  //         const transformedVoxels = math.multiply(
  //           affineMatrix,
  //           voxelHomogeneous,
  //         );
  //         const [wx, wy, wz] = transformedVoxels.slice(0, 3);
  //         return [wx, wy, wz, value];
  //       });

  //       console.log('MNI Coordinates:', mniCoordinates);

  //       // Set the state with the transformed coordinates
  //       setNiiCoords(mniCoordinates);
  //     } catch (error) {
  //       console.error('Error loading NIfTI file:', error);
  //     }
  //   };

  //   loadNiftiFile();
  // }, []);

  /// //////////// CSV ////////////

  // useEffect(() => {
  //   const loadCSVFile = async () => {
  //     try {
  //       // Invoke IPC to load NIfTI file
  //       const fileData = await window.electron.ipcRenderer.invoke(
  //         'load-csv-file',
  //         historical,
  //       );

  //       console.log(fileData);

  //       // Parse CSV data into an array of arrays
  //       const rows = fileData
  //       .trim() // Remove any extra whitespace or newline at the end
  //       .split('\n') // Split into rows
  //       .map((row) => row.split(',').map(Number)); // Split each row into columns and convert to numbers

  //         console.log(rows);
  //         setNiiCoords(rows);
  //       // Read header and image data
  //     } catch (error) {
  //       console.error('Error loading NIfTI file:', error);
  //     }
  //   };

  //   loadCSVFile();
  // }, []);

  // ******************* Don't forget 8=
  useEffect(() => {
    if (!sceneReady) return undefined;
    let cancelled = false;
    // This loads the anatomy.ply scene
    const loadPlyFile = async () => {
      try {
        const fileData = await window.electron.ipcRenderer.invoke(
          'load-ply-file-anatomy',
          historical,
        );
        if (cancelled || !fileData) return;
        // setPlyFile(fileData);
        const loader = new PLYLoader();
        const geometry = loader.parse(fileData);
        console.log('geometry: ', geometry);

        const material = new THREE.MeshStandardMaterial({
          vertexColors: geometry.hasAttribute('color'),
          flatShading: false, // Use smooth shading for better back-face visibility
          metalness: 0.1, // More reflective
          roughness: 0.5, // Shinier surface
          transparent: true, // Enable transparency
          opacity: 0.5, // Set opacity to 60%
          side: THREE.DoubleSide, // Render both sides so visible from any angle
          // Add emissive to ensure visibility even when not directly lit
          emissive: new THREE.Color(0x000000),
          emissiveIntensity: 0.1,
        });
        geometry.computeVertexNormals(); // Ensure normals are computed for proper lighting on both sides
        // eslint-disable-next-line no-use-before-define
        addMeshToScene('Anatomy', geometry, material);
      } catch (error) {
        console.error('Error loading PLY file:', error);
      }
    };

    loadPlyFile(); // Call the async function
    return () => {
      cancelled = true;
    };
  }, [historical, sceneReady]);

  useEffect(() => {
    // This loads in the combined electrodes for the selected patient
    const loadNiiFile = async () => {
      try {
        const fileData = await window.electron.ipcRenderer.invoke(
          'load-test-file',
          historical,
        );
        // processNifti(fileData, sceneRef.current);
        // Convert NIfTI data to a mesh using marching cubes with custom parameters
        // You can adjust these parameters based on your data
        const threshold = 0.3; // Lower threshold to capture more of the volume
        const colorMap = 'rainbow'; // Options: 'rainbow', 'grayscale', 'red', 'green', 'blue'
        // let mesh = null;
        const mesh = await nii2Mesh(fileData);
        console.log('mesh: ', mesh);
        // const mesh = await convertNiftiToMesh(fileData, threshold, colorMap);
        // mesh = processNifti(fileData, threshold, colorMap);
        // mesh = testPlane(sceneRef.current);
        // const [mesh, position, sliceCoordinates] = addSliceToSceneNew(fileData, sceneRef.current);
        // setSlice(sliceCoordinates);
        // Add the mesh to the scene
        if (mesh) {
          // addMeshToScene('NIfTI Volume', mesh.geometry, mesh.material, position);
          addMeshToScene('NIfTI Volume', mesh.geometry, mesh.material);

          // Log information about the mesh
          console.log(
            'Mesh added to scene:',
            mesh.geometry.attributes.position.count,
            'vertices',
          );
        } else {
          console.error('Failed to create mesh from NIfTI data');
        }
      } catch (error) {
        console.error('Error loading NIfTI file:', error);
      }
    };

    // loadNiiFile(); // Call the async function
  }, []);

  // New states for visibility and thresholding

  const [meshVisibility, setMeshVisibility] = useState({});
  const [meshOpacity, setMeshOpacity] = useState({});
  const [threshold, setThreshold] = useState(0.5); // Example thresholding value

  const [newTremor, setNewTremor] = useState({ name: '', coords: [0, 0, 0] });
  const [showModal, setShowModal] = useState(false);
  const [showPDModal, setShowPDModal] = useState(false);
  const [newPD, setNewPD] = useState({ name: '', coords: [0, 0, 0] });
  const [solutionText, setSolutionText] = useState('');
  const [stimParams, setStimParams] = useState({});
  const [tremorData, setTremorData] = useState([
    { name: 'Papavassilliou et al', coords: [14.5, -17.7, -2.8] },
    { name: 'Hamel et al', coords: [13.79, -18.04, -1.06] },
    { name: 'Herzog et al', coords: [14.04, -16.66, -2.92] },
    { name: 'Blomstedt et al', coords: [12.61, -17.24, -0.28] },
    { name: 'Barbe et al', coords: [12.31, -18.2, -1.26] },
    { name: 'Sandvik et al', coords: [13.77, -12.56, 1.5] },
    { name: 'Sandvik et al2', coords: [13.11, -16.53, -1.61] },
    { name: 'Fytagoridis et al', coords: [12.93, -17.17, -0.62] },
    { name: 'Cury et al', coords: [14.91, -4.47, -5.88] },
    { name: 'Fiechter et al', coords: [15.36, -16.3, -3.89] },
    { name: 'Barbe et al2', coords: [11.97, -16.64, -0.86] },
    { name: 'Nowacki et al', coords: [11.51, -16.04, 0.6] },
    { name: 'Nowacki et al2', coords: [13.75, -14.77, -3.1] },
    { name: 'Philipson et al', coords: [13.03, -18.4, -1.91] },
    { name: 'Tsuboi et al', coords: [15.35, -15.34, -0.51] },
    { name: 'Elias et al', coords: [17.3, -13.9, 4.2] },
    { name: 'Tsuboi et al2', coords: [15.0, -17.0, 1.0] },
    { name: 'Middlebrooks et al', coords: [15.5, -15.5, 0.5] },
  ]);

  const [pdData, setPdData] = useState([
    { name: 'Ehlen et al 2013', coords: [11.95, 14.16, 1.62] },
    { name: 'Horn et al 2017', coords: [14.04, -13.2, -4.8] },
    { name: 'Krugel et al 2014', coords: [12.13, -13.93, -6.93] },
    { name: 'Todt et al 2022', coords: [12.3, 1.6, 2.3] },
    { name: 'Akram et al 2017 - Rigidity', coords: [9, -13, -7] },
    { name: 'Akram et al 2017 - Tremor', coords: [11, -12, -6] },
    { name: 'Boutet et al 2024 - Bradykinesia', coords: [12.2, -13, -4.4] },
    { name: 'Dembek et al - Motor', coords: [13.3, -13.5, -5.4] },
    // { name: 'Avoidance coordinate - test', coords: [12.73, -14.36, -6.7] },
    // { name: 'Cognition < 65', coords: [14.3, -13.7, -3.7] },
    // { name: 'Cognition > 65', coords: [7.3, -10.2, -11.7] },
    // { name: 'Gait', coords: [6.2, -8.3, -9.7] },
  ]);

  useEffect(() => {
    setPdData((prevData) =>
      prevData.map((data) => ({
        ...data,
        coords: [-data.coords[0], data.coords[1], data.coords[2]],
      })),
    );
    setTremorData((prevData) =>
      prevData.map((data) => ({
        ...data,
        coords: [-data.coords[0], data.coords[1], data.coords[2]],
      })),
    );
  }, [side]);

  // Handle input change for new tremor data
  const handleNewTremorChange = (e) => {
    const { name, value } = e.target;
    setNewTremor((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNewPDChange = (e) => {
    const { name, value } = e.target;
    setNewPD((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Function to add new tremor data
  const addNewTremor = () => {
    const { name, coords } = newTremor;
    if (name && coords.length === 3) {
      setTremorData((prevData) => [
        ...prevData,
        { name, coords: coords.map(Number) },
      ]);
      // Reset the form
      setNewTremor({ name: '', coords: [0, 0, 0] });
    }
  };

  const addNewPD = () => {
    const { name, coords } = newPD;
    if (name && coords.length === 3) {
      setPdData((prevData) => [
        ...prevData,
        { name, coords: coords.map(Number) },
      ]);
      // Reset the form
      setNewPD({ name: '', coords: [0, 0, 0] });
    }
  };

  const [plyFiles, setPlyFiles] = useState([]); // Store both names and paths

  useEffect(() => {
    // Gathers atlases
    const fetchPlyFiles = async () => {
      try {
        // Request the PLY file paths from the main process using invoke/handle
        const files = await window.electron.ipcRenderer.invoke('get-ply-files');
        // Store both the file name and the full path in the state
        const fileData = files.map((file) => ({
          name: file.fileName.split('/').pop(), // Extract the atlas name from the path
          path: file.filePath, // Store the full path
        }));
        setPlyFiles(fileData);
      } catch (error) {
        console.error('Error fetching PLY files:', error);
      }
    };

    fetchPlyFiles();
  }, []); // Empty dependency array ensures this runs only on mount

  const [priorStims, setPriorStims] = useState(null);

  // useEffect(() => {
  //   // Gathers other stimulations from the database
  //   const fetchPlyFiles = async () => {
  //     try {
  //       // Request the PLY file paths from the main process using invoke/handle
  //       const files = await window.electron.ipcRenderer.invoke(
  //         'get-ply-files-database',
  //       );
  //       console.log('FILES: ', files);
  //       setPriorStims(files);
  //     } catch (error) {
  //       console.error('Error fetching PLY files:', error);
  //     }
  //   };

  //   fetchPlyFiles();
  // }, []); // Empty dependency array ensures this runs only on mount

  const [selectedFilePath, setSelectedFilePath] = useState(''); // Selected file path

  const addMeshToScene = (name, geometry, material, position) => {
    const scene = sceneRef.current;
    if (!scene) {
      geometry?.dispose?.();
      material?.dispose?.();
      return;
    }
    const replaceNames =
      name === 'Electrode Scene' || name === 'Generic electrode model'
        ? new Set(['Electrode Scene', 'Generic electrode model'])
        : new Set([name]);
    scene.children
      .filter((child) => replaceNames.has(child.name))
      .forEach((child) => {
        scene.remove(child);
        disposeSceneObject(child);
      });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; // Assign the name for reference
    if (position) {
      const [x, y, z] = position;
      mesh.position.set(x, y, z); // Set the position of the mesh
    }

    // Set render order for transparent objects to ensure proper rendering
    if (material.transparent) {
      mesh.renderOrder = 100; // Render transparent objects after opaque ones
    }

    scene.add(mesh);

    setMeshes((prevMeshes) => [
      ...prevMeshes.filter((existing) => !replaceNames.has(existing.name)),
      mesh,
    ]); // Add mesh to state
    setMeshProperties((prevProps) => ({
      ...prevProps,
      [name]: {
        visible: true,
        opacity: material?.opacity ?? 0.8,
        color: materialHexColor(material),
      },
    }));
  };

  const handleFileChange = async (event) => {
    // const selectedPath = event.target.value;
    // console.log(selectedPath);
    const loader = new PLYLoader();

    const selectedIndex = event.target.value;
    const selectedFile = plyFiles[selectedIndex]; // Get the file object using the index

    // You can now access the selected file's properties
    console.log('Selected File:', selectedFile);

    const selectedPath = selectedFile.path;
    const selectedName = selectedFile.name;

    try {
      // Load and parse the PLY file from Electron's IPC
      const fileData = await window.electron.ipcRenderer.invoke(
        'load-ply-file-2',
        selectedPath,
      );
      const geometry = loader.parse(fileData);

      // Create a material for the mesh
      const material = new THREE.MeshStandardMaterial({
        vertexColors: geometry.hasAttribute('color'),
        flatShading: false, // Use smooth shading for better back-face visibility
        metalness: 0.1,
        roughness: 0.5,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide, // Render both sides so visible from any angle
        // Add emissive to ensure visibility even when not directly lit
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0.1,
      });
      geometry.computeVertexNormals(); // Ensure normals are computed for proper lighting on both sides

      // Add the mesh to the scene
      addMeshToScene(selectedName, geometry, material);
    } catch (error) {
      console.error('Error loading PLY file:', error);
    }
  };

  const handleVisibilityChange = (meshName) => {
    setMeshProperties((prevProps) => ({
      ...prevProps,
      [meshName]: {
        ...prevProps[meshName],
        visible: !prevProps[meshName].visible,
      },
    }));

    // Toggle visibility in the scene
    const mesh = meshes.find((m) => m.name === meshName);
    if (mesh) {
      mesh.visible = !mesh.visible;
    }
  };

  const handleOpacityChange = (meshName, opacity) => {
    setMeshProperties((prevProps) => ({
      ...prevProps,
      [meshName]: {
        ...prevProps[meshName],
        opacity,
      },
    }));

    // Update opacity in the scene
    const mesh = meshes.find((m) => m.name === meshName);
    if (mesh) {
      mesh.material.opacity = opacity;
      mesh.material.transparent = opacity < 1;
      // Ensure double-sided rendering for transparent objects
      if (opacity < 1) {
        mesh.material.side = THREE.DoubleSide;
        mesh.renderOrder = 100; // Render transparent objects after opaque ones
        // Compute normals to ensure proper lighting on both sides
        if (mesh.geometry) {
          mesh.geometry.computeVertexNormals();
        }
      } else {
        mesh.renderOrder = 0; // Reset render order for opaque objects
      }
    }
  };

  const handleMeshColorChange = (meshName, hexColor) => {
    setMeshProperties((prevProps) => ({
      ...prevProps,
      [meshName]: {
        ...prevProps[meshName],
        color: hexColor,
      },
    }));

    const mesh = meshes.find((m) => m.name === meshName);
    if (mesh?.material?.color) {
      mesh.material.color.set(hexColor);
      mesh.material.needsUpdate = true;
    }
  };

  const handleRemoveMesh = (meshName) => {
    if (ELECTRODE_MESH_NAMES.has(meshName)) return;
    const scene = sceneRef.current;
    if (scene) {
      scene.children
        .filter((child) => child.name === meshName)
        .forEach((child) => {
          scene.remove(child);
          disposeSceneObject(child);
        });
    }
    delete niftiSourcesRef.current[meshName];
    setMeshes((prevMeshes) =>
      prevMeshes.filter((existing) => existing.name !== meshName),
    );
    setMeshProperties((prevProps) => {
      const nextProps = { ...prevProps };
      delete nextProps[meshName];
      return nextProps;
    });
  };

  const handleThresholdChange = (meshName, threshold_input) => {
    setMeshProperties((prevProps) => ({
      ...prevProps,
      [meshName]: {
        ...prevProps[meshName],
        threshold_input, // Store the new threshold value
      },
    }));

    // Update threshold in the scene (e.g., affecting the size or structure of the mesh)
    const mesh = meshes.find((m) => m.name === meshName);
    if (mesh) {
      // Assuming you're using threshold to adjust the scale or another property
      mesh.scale.set(threshold_input, threshold_input, threshold_input); // Scale the mesh uniformly based on threshold
      mesh.geometry.needsUpdate = true; // If necessary, update the geometry
    }
  };

  // const handleFileChange = async (event) => {
  //   const selectedPath = event.target.value;
  //   setSelectedFilePath(selectedPath);

  //   // Request the file via IPC from the Electron main process
  //   const fileData = await window.electron.ipcRenderer.invoke('load-ply-file-2', selectedPath);

  //   if (fileData) {
  //     setAtlas(fileData);
  //   } else {
  //     console.error('Failed to load the PLY file.');
  //   }
  // };

  const handleTremorChange = (event) => {
    const selectTremor = event.target.value;
    const tremorItem = tremorData[selectTremor];
    const [x, y, z] = tremorItem.coords;
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: getRandomColor(),
      transparent: true,
      opacity: 0.8,
    });

    addMeshToScene(tremorItem.name, sphereGeometry, sphereMaterial, [x, y, z]);
    // setSelectedTremor((prevSelectedTremor) => {
    //   if (prevSelectedTremor.includes(selectedValue)) {
    //     // If already selected, remove it
    //     return prevSelectedTremor.filter((item) => item !== selectedValue);
    //   }
    //   // If not selected, add it
    //   return [...prevSelectedTremor, selectedValue];
    // });
  };

  const handlePDChange = (event) => {
    const selectTremor = event.target.value;
    const tremorItem = pdData[selectTremor];
    const [x, y, z] = tremorItem.coords;
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: getRandomColor(),
      transparent: true,
      opacity: 0.8,
    });

    addMeshToScene(tremorItem.name, sphereGeometry, sphereMaterial, [x, y, z]);
    // setSelectedTremor((prevSelectedTremor) => {
    //   if (prevSelectedTremor.includes(selectedValue)) {
    //     // If already selected, remove it
    //     return prevSelectedTremor.filter((item) => item !== selectedValue);
    //   }
    //   // If not selected, add it
    //   return [...prevSelectedTremor, selectedValue];
    // });
  };

  function getRandomColor() {
    return Math.floor(Math.random() * 16777215); // Generate a random number between 0 and 0xFFFFFF
  }

  const addOrRemoveSpheres = () => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Check existing spheres and add only new ones
    selectedTremor.forEach((selectedItem) => {
      const tremorItem = tremorData.find((item) => item.name === selectedItem);
      if (
        tremorItem &&
        !sphereRefs.current.some((sphere) => sphere.name === selectedItem)
      ) {
        const [x, y, z] = tremorItem.coords;
        const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
        const sphereMaterial = new THREE.MeshStandardMaterial({
          color: getRandomColor(),
          transparent: true,
          opacity: 0.8,
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.set(x, y, z);

        // Assign the selectedItem as the sphere's name to track it
        sphere.name = selectedItem;

        scene.add(sphere);
        sphereRefs.current.push(sphere); // Add the new sphere to the list
      }
    });

    // Optionally, remove spheres if no longer selected
    sphereRefs.current = sphereRefs.current.filter((sphere) => {
      if (!selectedTremor.includes(sphere.name)) {
        scene.remove(sphere);
        return false; // Remove this sphere from the reference list
      }
      return true; // Keep this sphere
    });
  };

  // const { getRootProps, getInputProps } = useDropzone({
  //   accept: '.ply',
  //   onDrop: (acceptedFiles) => {
  //     const file = acceptedFiles[0];
  //     const reader = new FileReader();
  //     reader.onload = () => {
  //       setPlyFile(reader.result);
  //     };
  //     reader.readAsArrayBuffer(file);
  //   },
  // });
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
      9: { x: 0, y: 0, z: 0 }, // Contact 9 adjustment
      10: { x: 0, y: 0, z: 0 }, // Contact 10 adjustment
      11: { x: 0, y: 0, z: 0 }, // Contact 11 adjustment
      12: { x: 0, y: 0, z: 0 }, // Contact 12 adjustment
      13: { x: 0, y: 0, z: 0 }, // Contact 13 adjustment
      14: { x: 0, y: 0, z: 0 }, // Contact 14 adjustment
      15: { x: 0, y: 0, z: 0 }, // Contact 15 adjustment
      16: { x: 0, y: 0, z: 0 }, // Contact 16 adjustment
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
      9: 5,
      10: 5,
      11: 5,
      12: 5,
      13: 5,
      14: 5,
      15: 5,
      16: 5,
      17: 6,
      18: 6,
      19: 6,
      20: 6,
      21: 6,
      22: 6,
      23: 6,
      24: 6,
    };
  }
  const VTASpheresRef = useRef(null); // Store references to each sphere for updating later

  const clearAllSpheres = () => {
    // Traverse through all spheres and remove them
    Object.keys(VTASpheresRef).forEach((contactId) => {
      const sphere = VTASpheresRef[contactId];
      if (sphere) {
        sceneRef.current.remove(sphere);
        sphere.geometry.dispose();
        sphere.material.dispose();
        delete VTASpheresRef[contactId]; // Remove reference from VTASpheresRef
      }
    });
    // const scene = sceneRef.current;
    // VTASpheresRef.current = VTASpheresRef.current.filter((sphere) => {
    //   scene.remove(sphere);
    //   return true;
    // });
  };

  const handleIPG = (importedElectrode) => {
    if (
      importedElectrode.includes('Boston') ||
      importedElectrode.includes('boston')
    ) {
      return 'Boston';
    }
    if (
      importedElectrode.includes('Abbott') ||
      importedElectrode.includes('abbott')
    ) {
      return 'Abbott';
    }
    if (
      importedElectrode === 'Medtronic 3387' ||
      importedElectrode === 'Medtronic 3389' ||
      importedElectrode === 'medtronic_3387' ||
      importedElectrode === 'medtronic_3389' ||
      importedElectrode === 'medtronic_3391' ||
      importedElectrode === 'Medtronic 3391'
    ) {
      return 'Medtronic_Activa';
    }
    return 'Medtronic_Percept';
  };

  const handleImportedElectrode = (importedElectrode) => {
    switch (importedElectrode) {
      case 'Boston Scientific Vercise Directed':
        return 'boston_vercise_directed';
      case 'Medtronic 3389':
        return 'medtronic_3389';
      case 'Medtronic 3387':
        return 'medtronic_3387';
      case 'Medtronic 3391':
        return 'medtronic_3391';
      case 'Medtronic B33005':
        return 'medtronic_b33005';
      case 'Medtronic B33015':
        return 'medtronic_b33015';
      case 'Boston Scientific Vercise':
        return 'boston_scientific_vercise';
      case 'Boston Scientific Vercise Cartesia HX':
        return 'boston_scientific_vercise_cartesia_hx';
      case 'Boston Scientific Vercise Cartesia X':
        return 'boston_scientific_vercise_cartesia_x';
      case 'Abbott ActiveTip (6146-6149)':
        return 'abbott_activetip_2mm';
      case 'Abbott ActiveTip (6142-6145)':
        return 'abbott_activetip_3mm';
      case 'Abbott Directed 6172 (short)':
        return 'abbott_directed_05';
      case 'Abbott Directed 6173 (long)':
        return 'abbott_directed_15';
      default:
        return '';
    }
  };

  const gatherImportedDataNew = (jsonData, outputIPG) => {
    console.log(jsonData);

    const newQuantities = {};
    const newSelectedValues = {};
    const newTotalAmplitude = {};
    const newAllQuantities = {};
    const newAllVolAmpToggles = {};

    console.log('Imported Amplitude: ', jsonData.amplitude);
    const ls1ContactKeys = Object.keys(jsonData.Ls1).filter((key) =>
      key.startsWith('k'),
    );
    console.log('Number of contacts in Ls1:', ls1ContactKeys.length);
    const loopSize = ls1ContactKeys.length;
    for (let j = 1; j < 5; j++) {
      try {
        newTotalAmplitude[j] = jsonData.amplitude[1][j - 1];
        newTotalAmplitude[j + 4] = jsonData.amplitude[0][j - 1];
      } catch {
        console.log('');
      }

      try {
        newTotalAmplitude[j] = jsonData.amplitude.leftAmplitude[j - 1];
        newTotalAmplitude[j + 4] = jsonData.amplitude.rightAmplitude[j - 1];
      } catch {
        console.log('');
      }

      console.log('newTotalAmplitude: ', newTotalAmplitude);

      const dynamicKey2 = `Ls${j}`;
      const dynamicKey3 = `Rs${j}`;
      if (jsonData[dynamicKey2].va === 2) {
        newAllVolAmpToggles[j] = 'center';
      } else if (jsonData[dynamicKey2].va === 1) {
        newAllVolAmpToggles[j] = 'right';
      }

      if (jsonData[dynamicKey3].va === 2) {
        newAllVolAmpToggles[j + 4] = 'center';
      } else if (jsonData[dynamicKey3].va === 1) {
        newAllVolAmpToggles[j + 4] = 'right';
      }

      for (let i = 0; i < loopSize; i++) {
        const dynamicKey = `k${i + 7}`;
        const dynamicKey1 = `k${i}`;

        if (jsonData[dynamicKey2] && jsonData[dynamicKey2][dynamicKey]) {
          newQuantities[j] = newQuantities[j] || {};
          newQuantities[j][i] = parseFloat(
            jsonData[dynamicKey2][dynamicKey].perc,
          );
          newQuantities[j][0] = parseFloat(jsonData[dynamicKey2].case.perc);

          const { pol } = jsonData[dynamicKey2][dynamicKey];
          newSelectedValues[j] = newSelectedValues[j] || {};
          newSelectedValues[j][i] =
            pol === 0 ? 'left' : pol === 1 ? 'center' : 'right';

          const casePol = jsonData[dynamicKey2].case.pol;
          newSelectedValues[j][0] =
            casePol === 0 ? 'left' : casePol === 1 ? 'center' : 'right';
        }

        if (jsonData[dynamicKey3] && jsonData[dynamicKey3][dynamicKey1]) {
          newQuantities[j + 4] = newQuantities[j + 4] || {};
          newQuantities[j + 4][i + 1] = parseFloat(
            jsonData[dynamicKey3][dynamicKey1].perc,
          );
          newQuantities[j + 4][0] = parseFloat(jsonData[dynamicKey3].case.perc);

          const { pol } = jsonData[dynamicKey3][dynamicKey1];
          newSelectedValues[j + 4] = newSelectedValues[j + 4] || {};
          newSelectedValues[j + 4][i + 1] =
            pol === 0 ? 'left' : pol === 1 ? 'center' : 'right';

          const casePol = jsonData[dynamicKey3].case.pol;
          newSelectedValues[j + 4][0] =
            casePol === 0 ? 'left' : casePol === 1 ? 'center' : 'right';
        }
      }

      newAllQuantities[j] = newQuantities[j];
      newAllQuantities[j + 4] = newQuantities[j + 4];
    }

    const filteredValues = Object.keys(newSelectedValues)
      .filter((key) => Object.keys(newSelectedValues[key]).length > 0)
      .reduce((obj, key) => {
        obj[key] = newSelectedValues[key];
        return obj;
      }, {});

    const filteredQuantities = Object.keys(newQuantities)
      .filter((key) => Object.keys(newQuantities[key]).length > 0)
      .reduce((obj, key) => {
        obj[key] = newQuantities[key];
        return obj;
      }, {});

    console.log('TEST!L: ', outputIPG);
    // if (outputIPG.includes('Medtronic')) {
    //   Object.keys(filteredQuantities).forEach((key) => {
    //     console.log('Test: ', filteredQuantities[key]);
    //     Object.keys(filteredQuantities[key]).forEach((key2) => {
    //       filteredQuantities[key][key2] =
    //         (filteredQuantities[key][key2] / 100) * newTotalAmplitude[key];
    //     });
    //   });
    // }

    return {
      filteredQuantities,
      filteredValues,
      newTotalAmplitude,
    };

    // Need to add some type of filtering here that detects whether it is Medtronic Activa, and then needs to put just mA values, not %
  };

  const addPreviousVTA = (
    reconstruction,
    stimulationParameters,
    selectedPatientID,
    selectedSession,
  ) => {
    const { S } = stimulationParameters;
    console.log(reconstruction);
    // const outputElectrode = S.elmodel;
    const outputIPG = S.ipg;
    const processedData = gatherImportedDataNew(S, outputIPG);

    let rotationAngle = 0;
    if (side < 5 && Object.keys(quantities).length > 6) {
      rotationAngle = reconstruction.directionality.roll_out_left - 60;
    } else {
      rotationAngle = reconstruction.directionality.roll_out_right - 120;
    }
    const rotationQuaternion = new THREE.Quaternion();
    rotationQuaternion.setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      THREE.MathUtils.degToRad(rotationAngle),
    ); // Z-axis rotation
    console.log(steeringUnit);
    // Loop through all contact directions to handle adding and updating spheres
    Object.keys(contactDirections).forEach((contactId) => {
      console.log(steeringUnit);
      let contactQuantity = parseFloat(quantities[contactId]);
      let newAmplitude = amplitude;
      // if (togglePosition === 'center') {
      const newQuantities = processedData.filteredQuantities[side];
      console.log(newQuantities);
      newAmplitude = processedData.newTotalAmplitude[side];
      console.log(newAmplitude);
      // }
      contactQuantity = parseFloat(newQuantities[contactId]);

      // If contactQuantity is greater than 0, add or update the sphere
      if (contactQuantity > 0) {
        // Check if the sphere already exists in VTASpheresRef
        // if (!VTASpheresRef[contactId]) {
        // Calculate position and amplitude
        console.log('PLYViewer', quantities, keyLevels, contactDirections);
        const vectorLevel = keyLevels[contactId];
        const clampedLevel = Math.min(Math.max(vectorLevel, 1), 4);
        const normalizedLevel = (clampedLevel - 1) / (4 - 1);

        let startCoords = [];
        let targetCoords = [];
        if (side < 5) {
          const { head2: headMarkers, tail2: tailMarkers } =
            reconstruction.markers;
          startCoords = new THREE.Vector3(...headMarkers);
          targetCoords = new THREE.Vector3(...tailMarkers);
        } else {
          const { head1: headMarkers, tail1: tailMarkers } =
            reconstruction.markers;
          startCoords = new THREE.Vector3(...headMarkers);
          targetCoords = new THREE.Vector3(...tailMarkers);
        }

        // Calculate the direction of the electrode
        const direction = new THREE.Vector3()
          .subVectors(targetCoords, startCoords)
          .normalize();

        // Create an orthogonal basis for the electrode
        const up = new THREE.Vector3(0, 0, 1);
        const right = new THREE.Vector3()
          .crossVectors(direction, up)
          .normalize();
        const forward = new THREE.Vector3()
          .crossVectors(right, direction)
          .normalize();
        const newPosition = startCoords
          .clone()
          .lerp(targetCoords, normalizedLevel);
        const directionOffset = new THREE.Vector3(
          contactDirections[contactId].x,
          contactDirections[contactId].y,
          contactDirections[contactId].z,
        );

        // Apply the rotation to the directionOffset using the quaternion
        directionOffset.applyQuaternion(rotationQuaternion);

        // Apply the direction offset to the newPosition relative to the electrode's orientation
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
        // Side < 5 is left, side > 5 is right
        if (side < 5) {
          newPosition.x = reconstruction.coords_left[contactId][0];
          newPosition.y = reconstruction.coords_left[contactId][1];
          newPosition.z = reconstruction.coords_left[contactId][2];
        } else {
          newPosition.x = reconstruction.coords_right[contactId][0];
          newPosition.y = reconstruction.coords_right[contactId][1];
          newPosition.z = reconstruction.coords_right[contactId][2];
        }
        // Calculate amplitude based on contactQuantity
        const contactAmplitude = (contactQuantity / 100) * newAmplitude;

        // Create a new sphere
        const sphereGeo = new THREE.SphereGeometry(
          Math.sqrt((contactAmplitude - 0.1) / 0.22),
          32,
          32,
        );

        const sphereMat = new THREE.MeshStandardMaterial({
          color: 'blue', // Set the base color to red
          transparent: true, // Make the material transparent
          opacity: 0.8, // Set opacity to 80%
          roughness: 0.4, // Control the surface roughness (0 = smooth, 1 = rough)
          metalness: 0.1, // Control the metallic appearance (0 = non-metal, 1 = fully metallic)
          flatShading: false, // Enable smooth shading for better visual quality
          // Emissive properties
          emissive: 0xff0000, // Red glow
          emissiveIntensity: 0.2, // Controls the intensity of the emissive glow
          // Clearcoat for glossy surface
          // clearcoat: 1.0, // Max clearcoat effect
          // Specular highlights
          // Wireframe mode for structural view
          wireframe: false, // Turn on wireframe if needed
        });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);

        // Set the position of the sphere
        sphere.position.set(newPosition.x, newPosition.y, newPosition.z);
        // sphere.name = `contact_${contactId}`; // Name the sphere to track it
        addMeshToScene(
          `${selectedPatientID}_${selectedSession}_VTA`,
          sphereGeo,
          sphereMat,
          [newPosition.x, newPosition.y, newPosition.z],
        );
        // }
      }
    });
  };

  const handlePriorStimChange = async (event) => {
    const selectedValue = event.target.value;
    console.log('Selected stim change: ', selectedValue);
    // console.log('Selected Value: ', selectedValue.split('-'));
    const splitValues = selectedValue.split('-');
    console.log('Selected: ', splitValues);
    const selectedPatientID = splitValues[0];
    // const selectedPatientID = selectedValue;
    const selectedSession = splitValues[1];
    console.log(selectedPatientID);
    const outputPatientID = `${splitValues[0]}-${splitValues[1]}`;
    const outputPatientSession = `${splitValues[2]}-${splitValues[3]}`;
    const electrodeLoader = new PLYLoader();
    const anatomyLoader = new PLYLoader();

    try {
      // Load and parse the PLY file from Electron's IPC
      const fileData = await window.electron.ipcRenderer.invoke(
        'load-ply-file-database',
        // selectedPatientID,
        // selectedSession,
        outputPatientID,
        outputPatientSession,
      );
      const electrodeGeometry = electrodeLoader.parse(
        fileData.combinedElectrodesPly,
      );
      const anatomyGeometry = anatomyLoader.parse(fileData.anatomyPly);
      // Create a material for the mesh
      const material = new THREE.MeshStandardMaterial({
        // vertexColors: electrodeGeometry.hasAttribute('color'),
        color: new THREE.Color(0.1, 0.5, 0.8),
        flatShading: false, // Use smooth shading for better back-face visibility
        metalness: 0.1,
        roughness: 0.5,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide, // Render both sides so visible from any angle
        // Add emissive to ensure visibility even when not directly lit
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0.1,
      });
      electrodeGeometry.computeVertexNormals(); // Ensure normals are computed for proper lighting on both sides

      // Add the mesh to the scene
      addMeshToScene(
        `${selectedPatientID}-electrodes`,
        electrodeGeometry,
        material,
      );
      addPreviousVTA(
        fileData.reconstructionData,
        fileData.stimulationParameters,
        selectedPatientID,
        selectedSession,
      );
      // addMeshToScene(`${selectedPatientID}-electrodes`)
    } catch (error) {
      console.error('Error loading PLY file:', error);
    }
  };

  const calculatePercentageFromAmplitude = () => {
    const updatedQuantities = { ...quantities };
    const sourceAmplitude = Number(amplitude);
    Object.keys(updatedQuantities).forEach((key) => {
      const contactQuantity = Number(updatedQuantities[key]);
      updatedQuantities[key] =
        Number.isFinite(sourceAmplitude) && sourceAmplitude > 0
          ? (Math.max(0, contactQuantity || 0) * 100) / sourceAmplitude
          : 0;
    });
    return updatedQuantities;
  };

  const savedSpheres = useRef([]);

  const saveCurrentSpheres = () => {
    // Ensure VTASpheresRef is valid and contains spheres
    const sphereData = Object.keys(VTASpheresRef).reduce((acc, contactId) => {
      const sphere = VTASpheresRef[contactId];
      // Validate sphere and its position before saving
      if (sphere && sphere.position) {
        acc.push({
          id: contactId,
          position: sphere.position.clone(), // Clone the position to avoid direct reference issues
          radius: sphere.geometry.parameters.radius || 0, // Save amplitude, fallback to 0 if undefined
        });
      } else {
        console.warn(
          `Sphere with contactId ${contactId} is invalid or missing.`,
        );
      }
      return acc;
    }, []);

    if (sphereData.length === 0) {
      console.error('No valid spheres to save.');
      return;
    }

    // Save the validated sphere data
    savedSpheres.current.push(sphereData);
    console.log('Spheres saved:', savedSpheres.current);
  };

  const calculateOverlap = (sphere1, sphere2) => {
    const distance = sphere1.position.distanceTo(sphere2.position);
    const radius1 = sphere1.radius;
    const radius2 = sphere2.radius;

    if (distance >= radius1 + radius2) return 0; // No overlap
    if (distance <= Math.abs(radius1 - radius2)) {
      // One sphere is completely inside the other
      return (4 / 3) * Math.PI * Math.min(radius1, radius2) ** 3;
    }

    const r1 = radius1;
    const r2 = radius2;
    const d = distance;

    const volume1 =
      (Math.PI *
        (r1 + r2 - d) ** 2 *
        (d ** 2 +
          2 * d * r2 -
          3 * r2 ** 2 +
          2 * d * r1 +
          6 * r2 * r1 -
          3 * r1 ** 2)) /
      (12 * d);
    return volume1;
  };

  const calculatePercentOverlap = (savedSpheresData) => {
    console.log(savedSpheresData);
    if (savedSpheresData.length < 2) return;

    const overlaps = [];
    for (let i = 0; i < savedSpheresData.length; i++) {
      for (let j = i + 1; j < savedSpheresData.length; j++) {
        const overlap = calculateOverlap(
          savedSpheresData[i][0],
          savedSpheresData[j][0],
        );
        overlaps.push({
          pair: [savedSpheresData[i][0].id, savedSpheresData[j][0].id],
          overlapPercent:
            (overlap /
              Math.min(
                (4 / 3) * Math.PI * savedSpheresData[i][0].radius ** 3,
                (4 / 3) * Math.PI * savedSpheresData[j][0].radius ** 3,
              )) *
            100,
        });
      }
    }
    console.log('Overlaps:', overlaps);
  };

  // VTA
  const updateSpherePosition = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (!recoData) return;
    console.log(recoData);
    clearAllSpheres();

    const requestedSide = Number(side) < 5 ? 'left' : 'right';
    const reconstructionSide = extractFallbackElectrodeData(
      recoData,
    ).sides.find((candidate) => candidate.side === requestedSide);
    if (!reconstructionSide || reconstructionSide.contacts.length === 0) {
      return;
    }
    const newCoords = [];

    // Loop through all contact directions to handle adding and updating spheres
    Object.keys(contactDirections).forEach((contactId) => {
      console.log('Steering unit: ', steeringUnit);
      console.log('Quantities: ', quantities);
      // eslint-disable-next-line no-param-reassign
      // quantities = {
      //   0: 100,
      //   1: 60,
      //   2: 20,
      //   3: 0,
      //   4: 0,
      //   5: 0,
      //   6: 0,
      //   7: 0,
      //   8: 20,
      // };
      let contactQuantity = parseFloat(quantities[contactId]);
      if (usesPhysicalQuantities) {
        const newQuantities = calculatePercentageFromAmplitude();
        contactQuantity = parseFloat(newQuantities[contactId]);
      }

      // If contactQuantity is greater than 0, add or update the sphere
      if (contactQuantity > 0) {
        // Check if the sphere already exists in VTASpheresRef
        // if (!VTASpheresRef[contactId]) {
        // Calculate position and amplitude
        console.log('PLYViewer', quantities, keyLevels, contactDirections);
        const contactPosition =
          reconstructionSide.contacts[Number(contactId) - 1];
        if (!contactPosition) return;
        const newPosition = new THREE.Vector3(...contactPosition);
        newCoords.push([newPosition.x, newPosition.y, newPosition.z]);
        // Calculate amplitude based on contactQuantity
        const contactAmplitude = (contactQuantity / 100) * amplitude;

        // Create a new sphere
        const geometry = new THREE.SphereGeometry(
          Math.sqrt(Math.max(0.05, (contactAmplitude - 0.1) / 0.22)),
          32,
          32,
        );

        const material = new THREE.MeshStandardMaterial({
          color: 0xff0000, // Set the base color to red
          transparent: true, // Make the material transparent
          opacity: 0.8, // Set opacity to 80%
          roughness: 0.4, // Control the surface roughness (0 = smooth, 1 = rough)
          metalness: 0.1, // Control the metallic appearance (0 = non-metal, 1 = fully metallic)
          flatShading: false, // Enable smooth shading for better visual quality
          // Emissive properties
          emissive: 0xff0000, // Red glow
          emissiveIntensity: 0.1, // Controls the intensity of the emissive glow
          // Clearcoat for glossy surface
          // clearcoat: 1.0, // Max clearcoat effect
          // Specular highlights
          // blending: THREE.AdditiveBlending,
          specular: 0xffffff, // White specular highlights
          shininess: 15, // Sharpness of specular highlights
          // Wireframe mode for structural view
          // wireframe: true, // Turn on wireframe if needed
        });
        const sphere = new THREE.Mesh(geometry, material);

        // Set the position of the sphere
        sphere.position.set(newPosition.x, newPosition.y, newPosition.z);
        sphere.name = `contact_${contactId}`; // Name the sphere to track it

        // Add the sphere to the scene and store it in the VTASpheresRef
        scene.add(sphere);
        VTASpheresRef[contactId] = sphere; // Track the sphere by contactId
        // }
      }
    });

    // Remove spheres that are no longer needed
    Object.keys(VTASpheresRef).forEach((contactId) => {
      const contactQuantity = parseFloat(quantities[contactId]);

      // If the quantity for this contactId is 0, remove the sphere
      if (!contactQuantity || contactQuantity === 0) {
        const sphere = VTASpheresRef[contactId];
        if (sphere) {
          scene.remove(sphere);
          sphere.geometry.dispose();
          sphere.material.dispose();
          delete VTASpheresRef[contactId]; // Remove reference from VTASpheresRef
        }
      }
    });
  };

  const logCameraSettings = () => {
    console.log(recoData);
    if (cameraRef.current) {
      console.log('Camera Settings:');
      console.log('Position:', cameraRef.current.position);
      console.log('Rotation:', cameraRef.current.rotation);
      console.log('Zoom:', cameraRef.current.zoom);
      console.log('FOV:', cameraRef.current.fov);
      console.log('Near:', cameraRef.current.near);
      console.log('Far:', cameraRef.current.far);
    } else {
      console.log('Camera not initialized.');
    }
  };
  // Vis main view
  // useEffect(() => {
  //   if (mountRef.current) {
  //     // Initialize scene, camera, and renderer only once
  //     const scene = new THREE.Scene();
  //     sceneRef.current = scene; // Save scene reference
  //     scene.background = new THREE.Color(0xffffff); // White background

  //     // Create an OrthographicCamera
  //     const aspect = 300 / 600;
  //     const frustumSize = 100; // Adjust this value to control zoom
  //     const camera = new THREE.OrthographicCamera(
  //       (frustumSize * aspect) / -2, // left
  //       (frustumSize * aspect) / 2, // right
  //       frustumSize / 2, // top
  //       frustumSize / -2, // bottom
  //       0.1, // near plane
  //       1000, // far plane
  //     );

  //     // const camera = new THREE.PerspectiveCamera(75, 0.5, 0.1, 1000); // 1 is the aspect ratio (square)
  //     const renderer = new THREE.WebGLRenderer({ antialias: true });
  //     renderer.setSize(300, 600); // Set smaller size
  //     mountRef.current.appendChild(renderer.domElement);

  //     const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  //     scene.add(ambientLight);

  //     // if (side < 5) {
  //     //   // Create a clipping plane that only renders objects with x > 0
  //     //   const clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0); // Vector3(-1, 0, 0) means we're clipping based on the x axis

  //     //   // Enable the clipping planes in the renderer
  //     //   renderer.localClippingEnabled = true;

  //     //   // Apply the clipping plane to the entire scene
  //     //   renderer.clippingPlanes = [clipPlane];
  //     // } else {
  //     //   // Create a clipping plane that only renders objects with x > 0
  //     //   const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0); // Vector3(-1, 0, 0) means we're clipping based on the x axis

  //     //   // Enable the clipping planes in the renderer
  //     //   renderer.localClippingEnabled = true;

  //     //   // Apply the clipping plane to the entire scene
  //     //   renderer.clippingPlanes = [clipPlane];
  //     // }

  //     const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  //     directionalLight.position.set(5, 5, 5).normalize();
  //     scene.add(directionalLight);

  //     // const loader = new PLYLoader();
  //     // const geometry = loader.parse(plyFile);
  //     // // const material = new THREE.MeshStandardMaterial({
  //     // //   vertexColors: geometry.hasAttribute('color'),
  //     // //   flatShading: true,
  //     // // });

  //     // const material = new THREE.MeshStandardMaterial({
  //     //   vertexColors: geometry.hasAttribute('color'),
  //     //   flatShading: true,
  //     //   metalness: 0.1, // More reflective
  //     //   roughness: 0.5, // Shinier surface
  //     //   transparent: true, // Enable transparency
  //     //   opacity: 0.8, // Set opacity to 60%
  //     // });

  //     // geometry.computeVertexNormals();
  //     // const mesh = new THREE.Mesh(geometry, material);
  //     // scene.add(mesh);

  //     // OrbitControls setup (only initialize once)
  //     const controls = new OrbitControls(camera, renderer.domElement);
  //     controls.enableDamping = true;
  //     controls.dampingFactor = 0.1;
  //     controls.rotateSpeed = 0.8;
  //     controls.zoomSpeed = 0.5;
  //     controlsRef.current = controls;

  //     camera.position.set(0, -50, 60); // Zoomed out to start
  //     // camera.lookAt(0, 0, 0); // Ensure the camera is looking at the scene origin
  //     if (side < 5) {
  //       camera.lookAt(0, 100, 0); // Ensure the camera is looking at the scene origin
  //     } else {
  //       camera.lookAt(0, 0, 0); // Ensure the camera is looking at the scene origin
  //     }

  //     // const onWindowResize = () => {
  //     //   camera.aspect = window.innerWidth / window.innerHeight;
  //     //   camera.updateProjectionMatrix();
  //     //   renderer.setSize(window.innerWidth, window.innerHeight);
  //     // };
  //     const onWindowResize = () => {
  //       camera.left = (frustumSize * aspect) / -2;
  //       camera.right = (frustumSize * aspect) / 2;
  //       camera.top = frustumSize / 2;
  //       camera.bottom = frustumSize / -2;
  //       camera.updateProjectionMatrix();
  //       renderer.setSize(window.innerWidth, window.innerHeight);
  //     };
  //     window.addEventListener('resize', onWindowResize);

  //     rendererRef.current = renderer;
  //     cameraRef.current = camera;

  //     const animate = () => {
  //       requestAnimationFrame(animate);
  //       controls.update(); // Update OrbitControls
  //       renderer.render(sceneRef.current, camera);
  //     };
  //     animate();

  //     return () => {
  //       window.removeEventListener('resize', onWindowResize);
  //       renderer.dispose();
  //     };
  //   }
  // }, [plyFile]);

  useEffect(() => {
    if (mountRef.current && secondaryMountRef.current) {
      // Initialize scene, camera, and renderer only once
      const scene = new THREE.Scene();
      sceneRef.current = scene; // Save scene reference

      // Create a gradient background
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 1;
      canvas.height = 500;

      // Create a linear gradient
      const gradient = context.createLinearGradient(0, 0, 0, 500);

      // Define color stops to stay mostly blue through the whole way
      gradient.addColorStop(0, 'rgba(65, 92, 121, 0.6)'); // Darker second color stop
      gradient.addColorStop(0.8, '#2C3E50'); // Darker first color stop

      context.fillStyle = gradient;
      context.fillRect(0, 0, 1, 500);

      const texture = new THREE.CanvasTexture(canvas);
      // scene.background = texture;
      scene.background = new THREE.Color('black'); // White background

      // Create an OrthographicCamera
      const aspect = 500 / 500;
      const frustumSize = 45; // Adjust this value to control zoom
      const camera = new THREE.OrthographicCamera(
        (frustumSize * aspect) / -2, // left
        (frustumSize * aspect) / 2, // right
        frustumSize / 2, // top
        frustumSize / -2, // bottom
        0.1, // near plane
        1000, // far plane
      );

      // Secondary Camera Setup
      const secondaryWidth = 500;
      const secondaryHeight = 250; // Adjust height as needed
      const aspectSecondary = secondaryWidth / secondaryHeight;
      const secondaryFrustumHeight = frustumSize; // Set a smaller height for the secondary view
      const secondaryCamera = new THREE.OrthographicCamera(
        (secondaryFrustumHeight * aspectSecondary) / -2,
        (secondaryFrustumHeight * aspectSecondary) / 2,
        secondaryFrustumHeight / 2,
        secondaryFrustumHeight / -2,
        0.1,
        1000,
      );
      secondaryCamera.position.set(50, 50, 100);
      secondaryCamera.lookAt(0, 0, 0);

      // const camera = new THREE.PerspectiveCamera(75, 0.5, 0.1, 1000); // 1 is the aspect ratio (square)
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      // Enable proper transparency sorting
      renderer.sortObjects = true;
      // renderer.setSize(300, 600); // Set smaller size
      renderer.setSize(500, 500);
      mountRef.current.appendChild(renderer.domElement);

      const secondaryRenderer = new THREE.WebGLRenderer({ antialias: true });
      // Enable proper transparency sorting
      secondaryRenderer.sortObjects = true;
      secondaryRenderer.setSize(500, 250);
      secondaryMountRef.current.appendChild(secondaryRenderer.domElement);

      const ambientLight = new THREE.AmbientLight(0xffffff, 1.5); // Increased intensity for better back-face visibility
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Reduced to balance with ambient
      directionalLight.position.set(-5, -5, 5).normalize();
      scene.add(directionalLight);

      // Add a second directional light from the opposite side for better back-face illumination
      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight2.position.set(5, 5, -5).normalize();
      scene.add(directionalLight2);

      // Add backlighting - lights positioned behind the camera to illuminate back faces
      const backLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
      backLight1.position.set(0, 0, -10).normalize(); // Behind the scene
      scene.add(backLight1);

      const backLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
      backLight2.position.set(10, 10, -10).normalize(); // Behind and to the side
      scene.add(backLight2);

      const backLight3 = new THREE.DirectionalLight(0xffffff, 0.4);
      backLight3.position.set(-10, 10, -10).normalize(); // Behind and to the other side
      scene.add(backLight3);

      // OrbitControls setup (only initialize once)
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.rotateSpeed = 0.8;
      controls.zoomSpeed = 0.5;
      controlsRef.current = controls;

      // const secondaryControls = new OrbitControls(secondaryCamera, secondaryRenderer.domElement);
      // secondaryControls.enableDamping = true;
      // secondaryControls.dampingFactor = 0.1;
      // secondaryControls.rotateSpeed = 0.8;
      // secondaryControls.zoomSpeed = 0.5;
      // secondaryControlsRef.current = secondaryControls;

      camera.position.set(0, -50, 50); // Zoomed out to start

      rendererRef.current = renderer;
      secondaryCameraRef.current = secondaryCamera;
      secondaryRendererRef.current = secondaryRenderer;
      cameraRef.current = camera;
      setSceneReady(true);

      let animationFrameId = 0;
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        controls.update(); // Update OrbitControls
        renderer.render(scene, camera);
        secondaryRenderer.render(scene, secondaryCamera);
      };
      animate();

      return () => {
        setSceneReady(false);
        cancelAnimationFrame(animationFrameId);
        controls.dispose();
        disposeSceneObject(scene);
        renderer.domElement.remove();
        secondaryRenderer.domElement.remove();
        renderer.dispose();
        secondaryRenderer.dispose();
        controlsRef.current = null;
        rendererRef.current = null;
        secondaryRendererRef.current = null;
        cameraRef.current = null;
        secondaryCameraRef.current = null;
        if (sceneRef.current === scene) sceneRef.current = null;
      };
    }
    return undefined;
  }, []);

  // useEffect(() => {
  //   if (mountRef.current && secondaryMountRef.current) {
  //     // Initialize scene, camera, and renderer only once
  //     const scene = new THREE.Scene();
  //     sceneRef.current = scene; // Save scene reference
  //     scene.background = new THREE.Color(0xffffff); // White background

  //     // Create an OrthographicCamera
  //     const aspect = 300 / 600;
  //     const frustumSize = 75; // Adjust this value to control zoom
  //     const camera = new THREE.OrthographicCamera(
  //       (frustumSize * aspect) / -2, // left
  //       (frustumSize * aspect) / 2, // right
  //       frustumSize / 2, // top
  //       frustumSize / -2, // bottom
  //       0.1, // near plane
  //       1000, // far plane
  //     );

  //     // Secondary Camera Setup
  //     const secondaryWidth = 300;
  //     const secondaryHeight = 150; // Adjust height as needed
  //     const aspectSecondary = secondaryWidth / secondaryHeight;
  //     const secondaryFrustumHeight = frustumSize / 2; // Set a smaller height for the secondary view
  //     const secondaryCamera = new THREE.OrthographicCamera(
  //       (secondaryFrustumHeight * aspectSecondary) / -2,
  //       (secondaryFrustumHeight * aspectSecondary) / 2,
  //       secondaryFrustumHeight / 2,
  //       secondaryFrustumHeight / -2,
  //       0.1,
  //       1000,
  //     );
  //     secondaryCamera.position.set(50, 50, 100);
  //     secondaryCamera.lookAt(0, 0, 0);

  //     // const camera = new THREE.PerspectiveCamera(75, 0.5, 0.1, 1000); // 1 is the aspect ratio (square)
  //     const renderer = new THREE.WebGLRenderer({ antialias: true });
  //     // renderer.setSize(300, 600); // Set smaller size
  //     renderer.setSize(500, 1000);
  //     mountRef.current.appendChild(renderer.domElement);

  //     const secondaryRenderer = new THREE.WebGLRenderer({ antialias: true });
  //     secondaryRenderer.setSize(300, 150);
  //     secondaryMountRef.current.appendChild(secondaryRenderer.domElement);

  //     const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  //     scene.add(ambientLight);

  //     const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  //     directionalLight.position.set(5, 5, 5).normalize();
  //     scene.add(directionalLight);

  //     // OrbitControls setup (only initialize once)
  //     const controls = new OrbitControls(camera, renderer.domElement);
  //     controls.enableDamping = true;
  //     controls.dampingFactor = 0.1;
  //     controls.rotateSpeed = 0.8;
  //     controls.zoomSpeed = 0.5;
  //     controlsRef.current = controls;

  //     // const secondaryControls = new OrbitControls(secondaryCamera, secondaryRenderer.domElement);
  //     // secondaryControls.enableDamping = true;
  //     // secondaryControls.dampingFactor = 0.1;
  //     // secondaryControls.rotateSpeed = 0.8;
  //     // secondaryControls.zoomSpeed = 0.5;
  //     // secondaryControls.current = secondaryControls;

  //     // secondaryControlsRef.current = controls;

  //     camera.position.set(0, -50, 50); // Zoomed out to start
  //     // camera.lookAt(0, 0, 0); // Ensure the camera is looking at the scene origin

  //     // const onWindowResize = () => {
  //     //   camera.aspect = window.innerWidth / window.innerHeight;
  //     //   camera.updateProjectionMatrix();
  //     //   renderer.setSize(window.innerWidth, window.innerHeight);
  //     // };
  //     const onWindowResize = () => {
  //       camera.left = (frustumSize * aspect) / -2;
  //       camera.right = (frustumSize * aspect) / 2;
  //       camera.top = frustumSize / 2;
  //       camera.bottom = frustumSize / -2;
  //       camera.updateProjectionMatrix();
  //       renderer.setSize(window.innerWidth, window.innerHeight);
  //     };
  //     // window.addEventListener('resize', onWindowResize);

  //     rendererRef.current = renderer;
  //     secondaryCameraRef.current = secondaryCamera;
  //     secondaryRendererRef.current = secondaryRenderer;
  //     cameraRef.current = camera;

  //     const animate = () => {
  //       requestAnimationFrame(animate);
  //       controls.update(); // Update OrbitControls
  //       renderer.render(sceneRef.current, camera);
  //       secondaryRenderer.render(scene, secondaryCamera);
  //     };
  //     animate();

  //     return () => {
  //       // window.removeEventListener('resize', onWindowResize);
  //       renderer.dispose();
  //     };
  //   }
  // }, [plyFile]);

  useEffect(() => {
    if (atlas && sceneRef.current) {
      const scene = sceneRef.current;
      const loader = new PLYLoader();
      const geometry = loader.parse(atlas);
      const material = new THREE.MeshStandardMaterial({
        vertexColors: geometry.hasAttribute('color'),
        flatShading: false, // Use smooth shading for better back-face visibility
        metalness: 0.1,
        roughness: 0.5,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide, // Render both sides so visible from any angle
        // Add emissive to ensure visibility even when not directly lit
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0.1,
      });
      geometry.computeVertexNormals(); // Ensure normals are computed for proper lighting on both sides
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
    }
  }, [atlas]);

  useEffect(() => {
    if (sceneRef.current) {
      addOrRemoveSpheres();
    }
  }, [selectedTremor]);

  useEffect(() => {
    if (sceneRef.current) {
      updateSpherePosition();
    }
  }, [recoData]);

  useEffect(() => {
    if (quantities) {
      updateSpherePosition(); // Update the sphere position based on quantities
      // Object.keys(contactDirections).forEach((contactId) => {
      //   updateSpherePosition(contactId); // Create or update each sphere for every contactId
      // });
    }
  }, [quantities, amplitude, sceneRef]);

  const [unitSolutions, setUnitSolutions] = useState(null);

  async function loadNiftiAsVolume(arrayBuffer, scene) {
    // Initialize Niivue
    // let nv = new Niivue();
    // setPlotNiiCoords(arrayBuffer);
    // // await nv.loadVolumes([{ data: arrayBuffer, colormap: 'gray' }]);

    // // Get the volume data
    // let volume = nv.volumes[0];
    // if (!volume) {
    //   throw new Error('Failed to load volume.');
    // }

    // let dims = volume.hdr.dims; // [x, y, z] dimensions
    // let textureData = volume.img; // Intensity values

    // console.log(`Loaded volume with dimensions: ${dims}`);

    // // Create a 3D texture
    // let texture = new THREE.Data3DTexture(
    //   new Float32Array(textureData), // Convert to typed array
    //   dims[1], // width (X)
    //   dims[2], // height (Y)
    //   dims[3], // depth (Z)
    // );
    // texture.format = THREE.RedFormat;
    // texture.type = THREE.FloatType;
    // texture.minFilter = THREE.LinearFilter;
    // texture.magFilter = THREE.LinearFilter;
    // texture.wrapS = THREE.ClampToEdgeWrapping;
    // texture.wrapT = THREE.ClampToEdgeWrapping;
    // texture.wrapR = THREE.ClampToEdgeWrapping;

    // // Create a box geometry for the volume
    // let geometry = new THREE.BoxGeometry(dims[1], dims[2], dims[3]);

    // Shader Material for Volume Rendering
    // let material = new THREE.ShaderMaterial({
    //   uniforms: { volumeTexture: { value: texture } },
    //   vertexShader: `
    //         varying vec3 vUv;
    //         void main() {
    //             vUv = position;
    //             gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    //         }
    //     `,
    //   fragmentShader: `
    //         uniform sampler3D volumeTexture;
    //         varying vec3 vUv;
    //         void main() {
    //             float intensity = texture(volumeTexture, vUv).r;
    //             gl_FragColor = vec4(intensity, intensity, intensity, 1.0);
    //         }
    //     `,
    //   transparent: true,
    // });

    // let volumeMesh = new THREE.Mesh(geometry, material);
    // scene.add(volumeMesh);

    console.log('NIfTI volume rendered as a 3D texture.');
  }
  // Don't LOSE EFIELD SUPERIMPOSED
  // useEffect(() => {
  //   let tempUnitSolutions = null;
  //   if (!unitSolutions) {
  //     window.electron.ipcRenderer
  //       .invoke('get-unit-solutions', '')
  //       .then((solutions) => {
  //         tempUnitSolutions = solutions;
  //         console.log('tempUnitSolutions: ', tempUnitSolutions);
  //         setUnitSolutions(solutions);
  //       });
  //   }

  //   if (quantities && unitSolutions) {
  //     console.log('quantities temp vector: ', quantities);
  //     // Convert quantities struct to an array and remove the first index
  //     let quantitiesArray = Object.values(quantities).slice(1);
  //     quantitiesArray = quantitiesArray.map((value) => value * (amplitude / 100));
  //     // Divide each element in quantitiesArray by 1000
  //     quantitiesArray = quantitiesArray.map((value) => value / 1000);
  //     console.log('quantitiesArray: ', quantitiesArray);
  //     const output = computeSuperimposedEField(quantitiesArray, unitSolutions);
  //     console.log('output: ', output);
  //     const mesh = output.mesh;
  //     addMeshToScene('OSS VTA', mesh.geometry, mesh.material);
  //     // const img = output.eFieldMagnitude;
  //     // // const img = output.eFieldSuperimposed;
  //     // const dimensions = output.header.dims.slice(1, 4);
  //     // console.log('img: ', img);
  //     // // Generate voxel coordinates
  //     // const voxelCoordinates = [];
  //     // img.forEach((value, index) => {
  //     //   if (!isNaN(value)) {
  //     //     const z = Math.floor(index / (dimensions[0] * dimensions[1]));
  //     //     const y = Math.floor(
  //     //       (index % (dimensions[0] * dimensions[1])) / dimensions[0],
  //     //     );
  //     //     const x = index % dimensions[0];
  //     //     voxelCoordinates.push([x, y, z, value]);
  //     //   }
  //     // });
  //     // console.log('voxelCoordinates: ', voxelCoordinates);

  //     // const affineMatrix = output.header.affine;
  //     // const mniCoordinates = voxelCoordinates.map(([x, y, z, value]) => {
  //     //   const voxelHomogeneous = [x, y, z, 1]; // Add 1 for homogeneous transformation
  //     //   const transformedVoxels = math.multiply(affineMatrix, voxelHomogeneous);
  //     //   const [wx, wy, wz] = transformedVoxels.slice(0, 3);
  //     //   return [wx, wy, wz, value];
  //     // });

  //     // console.log('mniCoordinates: ', mniCoordinates);
  //     // // Binarize the mniCoordinates values
  //     // const threshold = 0.5; // Define a threshold value for binarization
  //     // const binarizedMniCoordinates = mniCoordinates.map(([x, y, z, value]) => {
  //     //   const binarizedValue = value > threshold ? 1 : 0;
  //     //   return [x, y, z, binarizedValue];
  //     // });

  //     // console.log('binarizedMniCoordinates: ', binarizedMniCoordinates);
  //     // const vertices = binarizedMniCoordinates.map(
  //     //   ([x, y, z]) => new THREE.Vector3(x, y, z),
  //     // );
  //     // Create a Delaunay triangulation from the vertices
  //     //       const delaunay = Delaunator.from(vertices.map(v => [v.x, v.y, v.z]));
  //     //       const indices = delaunay.triangles;
  //     //       console.log('indices: ', indices);

  //     //       let plyContent = `ply
  //     // format ascii 1.0
  //     // element vertex ${vertices.length}
  //     // property float x
  //     // property float y
  //     // property float z
  //     // element face ${indices.length / 3}
  //     // property list uchar int vertex_index
  //     // end_header
  //     // `;

  //     //       // Add vertices
  //     //       vertices.forEach(v => {
  //     //         plyContent += `${v.x} ${v.y} ${v.z}\n`;
  //     //       });

  //     //       // Add faces
  //     //       for (let i = 0; i < indices.length; i += 3) {
  //     //         plyContent += `3 ${indices[i]} ${indices[i + 1]} ${indices[i + 2]}\n`;
  //     //       }

  //     //       const loader = new PLYLoader();
  //     //       const geometry = loader.parse(plyContent);
  //     //       console.log('geometry: ', geometry);
  //     // const geometry = new THREE.ConvexGeometry(vertices);
  //     // const material = new THREE.MeshStandardMaterial({
  //     //   color: 0x00ff00,
  //     //   transparent: true,
  //     //   opacity: 0.8,
  //     // });

  //     // const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
  //     // console.log('geometry: ', geometry);
  //     // const material = new THREE.MeshStandardMaterial({
  //     //   vertexColors: false, // Disable vertex colors to see the base color
  //     //   flatShading: true,
  //     //   metalness: 0.1,
  //     //   roughness: 0.5,
  //     //   transparent: true,
  //     //   opacity: 0.8,
  //     //   color: 0xffffff,
  //     // });
  //     // eslint-disable-next-line no-use-before-define
  //     // addMeshToScene('PLY Scene', geometry, material);
  //     // const scene = sceneRef.current;
  //     // // const niiPath = binarizedMniCoordinates;
  //     // loadNiftiAsVolume(mniCoordinates, scene);
  //   }
  // }, [quantities, amplitude, unitSolutions]);

  ////////////////////////////////////////////////////////////////
  // useEffect(() => {
  //   const scene = sceneRef.current;
  //   try {
  //     // Extract vertices and R values from plotNiiCoords
  //     const vertices = plotNiiCoords.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  //     const rValues = plotNiiCoords.map(([x, y, z, r]) => r); // Extract R values

  //     // Create a geometry and add the vertices
  //     const geometry = new THREE.BufferGeometry().setFromPoints(vertices);

  //     // Create an array to hold colors for each point
  //     const colors = new Float32Array(vertices.length * 3);

  //     // Normalize R values for coloring
  //     const minR = Math.min(...rValues);
  //     const maxR = Math.max(...rValues);

  //     // Assign colors based on R values
  //     rValues.forEach((r, i) => {
  //       const color = new THREE.Color();

  //       const normalizedR = Math.atan(r) / Math.PI + 0.5;

  //       if (r < 0) {
  //         // Map negative R values to cooler colors (blue to cyan)
  //         color.setHSL(0.6 - 0.2 * normalizedR, 1.0, 0.5); // Hue: blue to cyan
  //       } else {
  //         // Map positive R values to warmer colors (yellow to red)
  //         color.setHSL(0.1 + 0.3 * normalizedR, 1.0, 0.6); // Hue: yellow to red, brighter
  //       }

  //       // Assign color values
  //       colors[i * 3] = color.r; // Red
  //       colors[i * 3 + 1] = color.g; // Green
  //       colors[i * 3 + 2] = color.b; // Blue
  //     });

  //     console.log(rValues);

  //     // Add the color attribute to the geometry
  //     geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  //     // Create a material for the points with vertexColors enabled
  //     const material = new THREE.PointsMaterial({
  //       vertexColors: true, // Enable per-vertex colors
  //       size: 5.0, // Increase size for better visibility
  //     });

  //     // Create the points object
  //     const points = new THREE.Points(geometry, material);

  //     // Add to the scene
  //     scene.add(points);
  //   } catch (err) {
  //     console.log(err);
  //   }
  // }, [plotNiiCoords]);

  // useEffect(() => {
  //   const scene = sceneRef.current;
  //   try {
  //     // Debugging: Log data samples and statistics
  //     console.log('Total Number of Points in plotNiiCoords:', plotNiiCoords.length);

  //     // Log the first 10 coordinates
  //     console.log('Sample Coordinates (First 10):');
  //     plotNiiCoords.slice(0, 10).forEach((coord, index) => {
  //       console.log(`Point ${index}:`, coord);
  //     });

  //     // Log a random sample of 10 points
  //     const sampleSize = 10;
  //     const randomSamples = Array.from({ length: sampleSize }, () => {
  //       const randomIndex = Math.floor(Math.random() * plotNiiCoords.length);
  //       return plotNiiCoords[randomIndex];
  //     });

  //     console.log('Random Sample of Coordinates:');
  //     randomSamples.forEach((coord, index) => {
  //       console.log(`Point ${index}:`, coord);
  //     });

  //     // Calculate summary statistics
  //     const xValues = plotNiiCoords.map(([x]) => x);
  //     const yValues = plotNiiCoords.map(([, y]) => y);
  //     const zValues = plotNiiCoords.map(([, , z]) => z);
  //     const rValues = plotNiiCoords.map(([, , , r]) => r);

  //     const getStats = (values) => {
  //       let min = Infinity;
  //       let max = -Infinity;
  //       let sum = 0;

  //       values.forEach((value) => {
  //         if (value < min) min = value;
  //         if (value > max) max = value;
  //         sum += value;
  //       });

  //       const mean = sum / values.length;

  //       return { min, max, mean };
  //     };

  //     console.log('X Stats:', getStats(xValues));
  //     console.log('Y Stats:', getStats(yValues));
  //     console.log('Z Stats:', getStats(zValues));
  //     console.log('R Stats:', getStats(rValues));

  //     // Log a grid view of coordinates
  //     const gridSize = 5; // Number of points to log per axis
  //     const step = Math.floor(plotNiiCoords.length / gridSize);

  //     console.log('Grid View of Coordinates:');
  //     for (let i = 0; i < plotNiiCoords.length; i += step) {
  //       console.log(`Point ${i}:`, plotNiiCoords[i]);
  //     }

  //     // Visualization: Subset data for rendering
  //     const samplingRate = 1; // Render 10% of points
  //     const sampledPlotNiiCoords = plotNiiCoords.filter(() => Math.random() < samplingRate);
  //     console.log('Number of Sampled Points:', sampledPlotNiiCoords.length);

  //     // Extract vertices and R values from sampled data
  //     const vertices = sampledPlotNiiCoords.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  //     const rValuesSampled = sampledPlotNiiCoords.map(([x, y, z, r]) => r);

  //     // Create a geometry and add the vertices
  //     const geometry = new THREE.BufferGeometry().setFromPoints(vertices);

  //     // Create an array to hold colors
  //     const colors = new Float32Array(vertices.length * 3);

  //     // Normalize R values for coloring
  //     const minR = Math.min(...rValuesSampled);
  //     const maxR = Math.max(...rValuesSampled);

  //     // Assign colors based on R values
  //     rValuesSampled.forEach((r, i) => {
  //       const color = new THREE.Color();
  //       const normalizedR = Math.atan(r) / Math.PI + 0.5;

  //       if (r < 0) {
  //         // Map negative R values to cooler colors (blue to cyan)
  //         color.setHSL(0.6 - 0.2 * normalizedR, 1.0, 0.5);
  //       } else {
  //         // Map positive R values to warmer colors (yellow to red)
  //         color.setHSL(0.1 + 0.3 * normalizedR, 1.0, 0.6);
  //       }

  //       // Assign color values
  //       colors[i * 3] = color.r;
  //       colors[i * 3 + 1] = color.g;
  //       colors[i * 3 + 2] = color.b;
  //     });

  //     // Add the color attribute to the geometry
  //     geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  //     // Create a material for the points with vertexColors enabled
  //     const material = new THREE.PointsMaterial({
  //       vertexColors: true, // Enable per-vertex colors
  //       size: 5.0, // Increase size for better visibility
  //     });

  //     // Create the points object
  //     const points = new THREE.Points(geometry, material);

  //     // Add to the scene
  //     scene.add(points);
  //   } catch (err) {
  //     console.error('Error in rendering:', err);
  //   }
  // }, [plotNiiCoords]);

  useEffect(() => {
    const scene = sceneRef.current;
    try {
      // Step 1: Filter extreme R values
      const filteredCoords = plotNiiCoords.filter(
        ([x, y, z, r]) => r > 1000000 && !isNaN(r) && r !== Infinity,
      );

      // Step 2: Extract and clamp R values
      const rValues = filteredCoords.map(([, , , r]) => r);
      // const rValues = filteredCoords.map(([, , , r]) => r);
      // const clampedRValues = rValues.map((r) =>
      //   Math.max(1e-5, Math.min(r, 1e5)),
      // );

      // // Step 3: Normalize R values linearly
      // const minR = Math.min(...clampedRValues);
      // const maxR = Math.max(...clampedRValues);
      // const normalizedRValues = clampedRValues.map(
      //   (r) => (r - minR) / (maxR - minR),
      // );

      // console.log('Filtered and Normalized R Values:', normalizedRValues);

      // Step 4: Create vertices and geometry
      // const vertices = filteredCoords.map(
      //   ([x, y, z]) => new THREE.Vector3(x, y, z),
      // );
      const testVertices = filteredCoords.map(
        ([x, y, z]) => new THREE.Vector3(x, y, z),
      );
      console.log('Number of vertices:', testVertices.length);
      // const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
      const geometry = new THREE.BufferGeometry().setFromPoints(testVertices);

      // Step 5: Create colors array
      // const colors = new Float32Array(vertices.length * 3);
      // normalizedRValues.forEach((r, i) => {
      //   const color = new THREE.Color();
      //   color.setHSL(0.1 + 0.3 * r, 1.0, 0.6); // Yellow to red
      //   colors[i * 3] = color.r;
      //   colors[i * 3 + 1] = color.g;
      //   colors[i * 3 + 2] = color.b;
      // });

      const colors = new Float32Array(testVertices.length * 3);
      rValues.forEach((r, i) => {
        const color = new THREE.Color();
        color.setHSL(0.1 + 0.3 * r, 1.0, 0.6); // Yellow to red
        // colors[i * 3] = color.r;
        // colors[i * 3 + 1] = color.g;
        // colors[i * 3 + 2] = color.b;
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 1.0;
        colors[i * 3 + 2] = 0.0;
      });

      // Add colors to geometry
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      // Create and add points to the scene
      const material = new THREE.PointsMaterial({
        vertexColors: true,
        size: 5.0,
        transparent: true,
        opacity: 0.2,
        blending: THREE.NormalBlending,
      });
      const points = new THREE.Points(geometry, material);
      scene.add(points);
    } catch (err) {
      console.error('Error in rendering:', err);
    }
  }, [plotNiiCoords]);

  const [zoomLevel, setZoomLevel] = useState(-3);

  const reconstructionCameraBounds = () => {
    const requestedSide = Number(side) < 5 ? 'left' : 'right';
    const bounds = getFallbackElectrodeBounds(recoData, requestedSide);
    if (!bounds) return null;
    return {
      center: new THREE.Vector3(...bounds.center),
      size: new THREE.Vector3(...bounds.size),
    };
  };

  const selectedReconstructionMarkers = () => {
    const requestedSide = Number(side) < 5 ? 'left' : 'right';
    const selectedSide = extractFallbackElectrodeData(recoData).sides.find(
      (candidate) => candidate.side === requestedSide,
    );
    if (!selectedSide?.head || !selectedSide.tail) return null;
    return {
      head: new THREE.Vector3(...selectedSide.head),
      tail: new THREE.Vector3(...selectedSide.tail),
    };
  };

  const selectedDirectionalityAngle = () => {
    const isLeft = Number(side) < 5;
    const rawRoll =
      recoData?.directionality?.[isLeft ? 'roll_out_left' : 'roll_out_right'];
    if (
      rawRoll === null ||
      rawRoll === undefined ||
      (Array.isArray(rawRoll) && rawRoll.length === 0) ||
      (typeof rawRoll === 'string' && rawRoll.trim() === '')
    ) {
      return 0;
    }
    const roll = Number(rawRoll);
    if (!Number.isFinite(roll)) return 0;
    return roll - (isLeft ? 60 : 120);
  };

  // The fixed bottom view looks from above the proximal (tail) end of the
  // lead straight down the shaft toward the distal head. The pose is derived
  // directly from the reconstruction markers (with a principal-axis fit over
  // the contacts as fallback), so arbitrary lead orientations stay axial
  // instead of going oblique.
  const changeCameraAngle = () => {
    const camera = secondaryCameraRef.current;
    if (!camera) return;

    const requestedSide = Number(side) < 5 ? 'left' : 'right';
    const { sides } = extractFallbackElectrodeData(recoData);
    const selectedSide =
      sides.find((candidate) => candidate.side === requestedSide) ?? sides[0];
    const pose = selectedSide
      ? createLeadAxisCameraPose({
          head: selectedSide.head,
          tail: selectedSide.tail,
          contacts: selectedSide.contacts,
          baseFrustumHeight: 45,
          aspect: 2, // 500 x 250 render surface
          minimumVisibleHeight: 8,
          padding: 1.5,
        })
      : null;

    if (pose) {
      camera.up.set(...pose.up);
      camera.position.set(...pose.position);
      camera.lookAt(...pose.target);
      camera.near = 0.1;
      camera.far = Math.max(1000, pose.distance * 4);
      camera.zoom = pose.zoom;
      camera.updateProjectionMatrix();
      return;
    }

    // Fallback framing when no markers or contacts are available at all.
    const bounds = reconstructionCameraBounds();
    if (!bounds) return;
    const distance = Math.max(25, bounds.size.length() * 2.5);
    camera.up.set(0, 0, 1);
    camera.position.copy(
      bounds.center.clone().add(new THREE.Vector3(0, -distance, distance)),
    );
    camera.lookAt(bounds.center);
    camera.zoom = Math.min(
      4,
      Math.max(
        0.75,
        30 / Math.max(bounds.size.x, bounds.size.y, bounds.size.z, 1),
      ),
    );
    camera.updateProjectionMatrix();
  };

  const changePrimaryCameraAngle = () => {
    const camera = cameraRef.current;
    const bounds = reconstructionCameraBounds();
    if (!camera || !bounds) return;
    const distance = Math.max(25, bounds.size.length() * 2.5);
    camera.position.copy(
      bounds.center.clone().add(new THREE.Vector3(0, -distance, distance)),
    );
    camera.lookAt(bounds.center);
    camera.zoom = Math.min(
      3,
      Math.max(
        0.75,
        25 / Math.max(bounds.size.x, bounds.size.y, bounds.size.z, 1),
      ),
    );
    camera.updateProjectionMatrix();
  };

  useEffect(() => {
    if (recoData) {
      changeCameraAngle();
      if (electrodeGeometryStatus === 'fallback') {
        changePrimaryCameraAngle();
      }
    }
  }, [electrodeGeometryStatus, recoData, side]);

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

  const calvinsGoodness = (candidate, target, avoidance) => {
    const euclideanDistance = (point1, point2) => {
      const [x1, y1, z1] = point1;
      const [x2, y2, z2] = point2;
      return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2);
    };

    const distanceToTarget = euclideanDistance(candidate, target);
    const distanceToAvoidance = euclideanDistance(candidate, avoidance);
    const sum = distanceToTarget + distanceToAvoidance;

    // Calculate the normalized goodness score
    return (distanceToAvoidance - distanceToTarget) / sum;
  };

  const findOptimalCoordinate = (target, avoidance, candidates) => {
    const scores = candidates.map((candidate, index) => ({
      index,
      score: calvinsGoodness(candidate, target, avoidance),
    }));

    // Sort by score in descending order (best to worst)
    scores.sort((a, b) => b.score - a.score);

    const bestIndex = scores[0].index;
    const rankedIndices = scores.map((item) => item.index);
    const [x1, y1, z1] = target;
    const [x2, y2, z2] = candidates[bestIndex];
    const distance = Math.sqrt(
      (x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2,
    );

    return { bestIndex, rankedIndices, distance };
  };

  // const calculateAmplitude = (distance, k = 1.3) => {
  //   console.log(distance);
  //   return (distance / k) ** 2;
  // };

  // const calculateAmplitude = (distance, k = 1.3) => {
  //   const tmpAmp = (distance / k) ** 2;
  //   return Math.round(tmpAmp * 10) / 10;
  // };

  const calculateAmplitude = (distance, k = 0.22) => {
    const tmpAmp = k * distance ** 2 + 0.1;
    return Math.round(tmpAmp * 10) / 10;
  };

  const getCoordsForRoi = () => {
    // Determine if selected roi is from tremorData or pdData
    const [dataType, index] = roi.split('-');
    const data = dataType === 'tremor' ? tremorData : pdData;
    return data[parseInt(index, 10)].coords;
  };

  const getCoordsForAvoidRoi = () => {
    // Determine if selected roi is from tremorData or pdData
    const [dataType, index] = avoidRoi.split('-');
    const data = dataType === 'tremor' ? tremorData : pdData;
    return data[parseInt(index, 10)].coords;
  };

  const handleNiftiQuantityStateChange = (v) => {
    console.log(stimParams);
    const program = niftiValuesToViewerProgram(
      v,
      { quantities, selectedValues },
      steeringUnit,
    );
    onProgramChange(
      program.quantities,
      program.selectedValues,
      program.amplitude,
    );
  };

  const handleQuantityStateChange = (index, tmpAmp) => {
    console.log(stimParams);
    const updatedQuantities = { ...quantities };
    const updatedSelectedValues = { ...selectedValues };
    const changedContact = index + 1;
    Object.keys(updatedQuantities).forEach((contact) => {
      if (parseFloat(contact) === 0) {
        return;
      }
      if (parseFloat(contact) === changedContact) {
        updatedSelectedValues[contact] = 'center';
        if (usesPhysicalQuantities) {
          updatedQuantities[contact] = tmpAmp;
        } else {
          updatedQuantities[contact] = 100;
        }
      } else {
        updatedQuantities[contact] = 0;
        updatedSelectedValues[contact] = 'left';
      }
    });
    onProgramChange(updatedQuantities, updatedSelectedValues, tmpAmp);
  };

  const handleQuantityStateChangeGroup = (indexList, tmpAmp, contactShare) => {
    console.log(stimParams);
    const updatedQuantities = { ...quantities };
    const updatedSelectedValues = { ...selectedValues };

    Object.keys(updatedQuantities).forEach((contact) => {
      if (parseFloat(contact) === 0) {
        return;
      }

      // Check if the contact is in the list of specified indexes
      if (indexList.includes(parseFloat(contact) - 1)) {
        updatedSelectedValues[contact] = 'center';
        updatedQuantities[contact] = usesPhysicalQuantities
          ? tmpAmp * contactShare[parseFloat(contact - 1)]
          : 100 * contactShare[parseFloat(contact - 1)];
      } else {
        updatedQuantities[contact] = 0;
        updatedSelectedValues[contact] = 'left';
      }
    });
    onProgramChange(updatedQuantities, updatedSelectedValues, tmpAmp);
  };

  const cylinderSurfaceArea = (
    diameter = elspec.contact_diameter / 1000,
    height = elspec.contact_length / 1000,
    n_contacts = 1,
  ) => {
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

  const handleSafety = (amp) => {
    const contactSurfaceArea = cylinderSurfaceArea();
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

  const handleSTNParameters = () => {
    const selectedMarkers = selectedReconstructionMarkers();
    if (!selectedMarkers) {
      console.warn(
        'STN parameter optimization needs head and tail markers for the selected electrode side.',
      );
      return;
    }
    const STNCoords = new THREE.Vector3(11.28, -13.92, -9.02);
    const bestQuantities = {};
    const bestAmplitude = amplitude; // Initial amplitude
    const minDistance = Infinity;

    const newCoords = [];

    const rotationAngle = selectedDirectionalityAngle();
    const rotationQuaternion = new THREE.Quaternion();
    rotationQuaternion.setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      THREE.MathUtils.degToRad(rotationAngle),
    ); // Z-axis rotation

    Object.keys(contactDirections).forEach((contactId) => {
      console.log(steeringUnit);
      let contactQuantity = parseFloat(quantities[contactId]);
      if (usesPhysicalQuantities) {
        const newQuantities = calculatePercentageFromAmplitude();
        contactQuantity = parseFloat(newQuantities[contactId]);
      }

      // If contactQuantity is greater than 0, add or update the sphere
      // Check if the sphere already exists in VTASpheresRef
      // if (!VTASpheresRef[contactId]) {
      // Calculate position and amplitude
      console.log('PLYViewer', quantities, keyLevels, contactDirections);
      const vectorLevel = keyLevels[contactId];
      const clampedLevel = Math.min(Math.max(vectorLevel, 1), 4);
      const normalizedLevel = (clampedLevel - 1) / (4 - 1);

      const startCoords = selectedMarkers.head;
      const targetCoords = selectedMarkers.tail;

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
      const newPosition = startCoords
        .clone()
        .lerp(targetCoords, normalizedLevel);

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

      // Apply the direction offset to the newPosition relative to the electrode's orientation
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
    setElecCoords(newCoords);
    console.log('Roi coords: ', getCoordsForRoi());
    const sweetspotCoord = getCoordsForRoi();
    const coordinateOutput = findNearestCoordinate(sweetspotCoord, newCoords);
    const activeContact = coordinateOutput.index;
    const activeAmplitude = calculateAmplitude(coordinateOutput.distance);
    console.log(coordinateOutput.distanceArray);
    console.log(activeAmplitude);
    console.log(activeContact);
    let finalAmplitude = activeAmplitude;
    if (activeAmplitude > 5) {
      finalAmplitude = handleSafety(activeAmplitude);
    }
    console.log(finalAmplitude);
    setStimParams({
      index: activeContact + 1,
      amplitude: finalAmplitude,
      distanceMaster: coordinateOutput.distanceArray,
    });
    const outputText = `Active Contact: ${
      names[activeContact + 1]
    }, Amplitude: ${finalAmplitude}`;
    setSolutionText(outputText);
    handleQuantityStateChange(activeContact, finalAmplitude);
  };

  const handleAddContacts = () => {
    console.log(stimParams);
    const newIndex = stimParams.distanceMaster[1].index;
    const newDistance = stimParams.distanceMaster[1].distance;
    const newAmplitude = calculateAmplitude(newDistance);
    console.log(newAmplitude);
    const newContact = newIndex + 1;
    const totalAmplitude = stimParams.amplitude + newAmplitude;
    console.log(stimParams.amplitude);
    console.log(totalAmplitude);
    const contactShare = {};
    contactShare[stimParams.distanceMaster[0].index] =
      stimParams.amplitude / totalAmplitude;
    contactShare[newIndex] = newAmplitude / totalAmplitude;
    console.log(contactShare);
    const outputAmplitude =
      totalAmplitude > 5 ? stimParams.amplitude : totalAmplitude;
    const outputText = `Active Contacts: ${
      names[stimParams.distanceMaster[0].index + 1]
    } and ${names[newContact]}, Amplitude: ${stimParams.amplitude}`;
    setSolutionText(outputText);
    handleQuantityStateChangeGroup(
      [stimParams.distanceMaster[0].index, newIndex],
      outputAmplitude,
      contactShare,
    );
  };

  const handleAvoidance = () => {
    // const avoidCoord = [12.73, -14.36, -6.7];
    // const avoidCoord = [7.3, -10.2, -11.7];
    const avoidCoord = getCoordsForAvoidRoi();
    const sweetspotCoord = getCoordsForRoi();
    const { bestIndex, rankedIndices, distance } = findOptimalCoordinate(
      sweetspotCoord,
      avoidCoord,
      elecCoords,
    );
    console.log(bestIndex);
    const newContact = bestIndex + 1;
    const outputText = `${names[newContact]}`;
    const newAmplitude = calculateAmplitude(distance);
    setSolutionText(outputText);
    const outputAmplitude =
      newAmplitude < 5 ? newAmplitude : stimParams.amplitude;
    // handleQuantityStateChange(bestIndex, stimParams.amplitude);
    handleQuantityStateChange(bestIndex, outputAmplitude);
  };

  const handleRoiChange = (event) => {
    console.log(event.target.value);
    setRoi(event.target.value);
  };

  const handleAvoidanceRoiChange = (event) => {
    console.log(event.target.value);
    setAvoidRoi(event.target.value);
  };

  useEffect(() => {
    try {
      const selectedMarkers = selectedReconstructionMarkers();
      if (!selectedMarkers) return;
      const newCoords = [];

      const rotationAngle = selectedDirectionalityAngle();
      const rotationQuaternion = new THREE.Quaternion();
      rotationQuaternion.setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        THREE.MathUtils.degToRad(rotationAngle),
      ); // Z-axis rotation

      Object.keys(contactDirections).forEach((contactId) => {
        console.log(steeringUnit);
        let contactQuantity = parseFloat(quantities[contactId]);
        if (usesPhysicalQuantities) {
          const newQuantities = calculatePercentageFromAmplitude();
          contactQuantity = parseFloat(newQuantities[contactId]);
        }

        // If contactQuantity is greater than 0, add or update the sphere
        // Check if the sphere already exists in VTASpheresRef
        // if (!VTASpheresRef[contactId]) {
        // Calculate position and amplitude
        console.log('PLYViewer', quantities, keyLevels, contactDirections);
        const vectorLevel = keyLevels[contactId];
        const clampedLevel = Math.min(Math.max(vectorLevel, 1), 4);
        const normalizedLevel = (clampedLevel - 1) / (4 - 1);

        const startCoords = selectedMarkers.head;
        const targetCoords = selectedMarkers.tail;

        // Calculate the direction of the electrode
        const direction = new THREE.Vector3()
          .subVectors(targetCoords, startCoords)
          .normalize();

        // Create an orthogonal basis for the electrode
        const up = new THREE.Vector3(0, 0, 1); // Assuming 'up' is along the global Z-axis
        const right = new THREE.Vector3()
          .crossVectors(direction, up)
          .normalize();
        const forward = new THREE.Vector3()
          .crossVectors(right, direction)
          .normalize();

        // Linearly interpolate between startCoords and targetCoords based on normalizedLevel
        const newPosition = startCoords
          .clone()
          .lerp(targetCoords, normalizedLevel);

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

        // Apply the direction offset to the newPosition relative to the electrode's orientation
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
      setElecCoords(newCoords);
    } catch (err) {
      console.log(err);
    }
  }, [recoData, side]);

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

  // /**
  //  * Orchestrates the optimization process using gradient ascent.
  //  *
  //  * STOP Rules
  //  * grad L1 norm     - not implemented
  //  * grad L2 norm     - not implemented
  //  * max iterations   - implemented
  //  * convergence      - not implemented
  //  * plateau dtxn     - not implemented
  //  *
  //  * NOTES:
  //  * Potential Logical Error: No safeguard against differing array lengths.
  //  * Ensure that sphereCoords and v are always of equal length to prevent unintended behavior.
  //  *
  //  * Performs a maximum of 100 iterations and includes placeholders for additional stopping rules.
  //  * @param {Array} sphereCoords - Array of sphere centers, each center is an [x, y, z] coordinate.
  //  * @param {Array} v - Initial guess for the array of contact values (e.g., [q1, q2, q3, q4]).
  //  * @param {Array} L - Flattened landscape values, an array of (n,m) where n is the points and m is 4 cols (x coord,y coord,z coord,magnitude)
  //  * @param {number} lambda - Penalty coefficient.
  //  * @param {number} alpha - Learning rate for gradient ascent (step size).
  //  * @param {number} h - Small step size for numerical differentiation.
  //  * @returns {Array} - Optimized array of contact values.
  //  */
  // const optimizeSphereValues = (
  //   sphereCoords,
  //   v,
  //   L,
  //   lambda = 10,
  //   alpha = 0.01,
  //   h = 0.05,
  // ) => {
  //   validateInputs(sphereCoords, v, L); // throw errors if inputs are incorrect.

  //   let currentV = [...v]; // Clone the initial guess for v
  //   let iteration = 0;
  //   const reducedL = filterBoxAroundSphere(L, sphereCoords, 20, 2);
  //   console.log(reducedL);
  //   setPlotNiiCoords(reducedL);
  //   while (iteration < 5) {
  //     //  allows 100 steps of 0.05mA changes (max of 5mA in total change)
  //     const gradientVector = gradientVectorHandler(
  //       currentV,
  //       h,
  //       sphereCoords,
  //       reducedL,
  //       lambda,
  //     ); // get gradient
  //     const updatedV = gradientAscent(gradientVector, currentV, alpha); // ascend gradient
  //     currentV = updatedV; // update
  //     iteration += 1; // increment
  //   }
  //   console.log(`Optimization completed after ${iteration} iterations.`);
  //   return currentV;
  // };

  const handleNiiMap = (importedCoords) => {
    const sphereCoords = elecCoords;
    console.log(elecCoords);
    // const v = [0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75];
    const v = Array.from(
      { length: sphereCoords.length },
      () => 4 / Math.max(sphereCoords.length, 1),
    );
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
      finalAmplitude = handleSafety(activeAmplitude);
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
    const equalAmplitude =
      otherContacts > 0 ? remainingAmplitude / otherContacts : 0;

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
    console.log('Output V: ', outputV);
    const newOutputV = projectNumContacts(
      sphereCoords,
      outputV,
      1,
      normalizedPlotNiiCoords,
    );
    console.log('New Output V: ', newOutputV);
    const roundedOutputV = outputV.map((value) => Math.round(value * 10) / 10);
    console.log('Rounded Output V: ', roundedOutputV);
    // console.log(outputV);
    handleNiftiQuantityStateChange(roundedOutputV);
    // handleNiftiQuantityStateChange(newOutputV);

    // setNiiSolution(outputV);
  };

  const niiFile = useRef(null);

  const handleNiiButtonClick = () => {
    if (niiFile.current) {
      niiFile.current.click();
    }
  };

  const plotNifti = (mniCoordinates) => {
    const geometry = new THREE.BufferGeometry();

    // Extract positions and colors
    const positions = [];
    const colors = [];
    const color = new THREE.Color();

    mniCoordinates.forEach(([x, y, z, value]) => {
      // Push positions (scaled if necessary)
      positions.push(x, y, z);

      // Map value to color (e.g., from blue to red)
      const intensity = Math.min(Math.max(value, 0), 1); // Normalize to [0, 1]
      color.setHSL(0.7 * (1 - intensity), 1, 0.5); // Adjust HSL for color mapping
      colors.push(color.r, color.g, color.b);
    });

    // Add positions and colors to the geometry
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // Create a material
    const material = new THREE.PointsMaterial({
      size: 0.5, // Adjust size of points
      vertexColors: true, // Use colors from geometry
    });

    // Create the points object
    const points = new THREE.Points(geometry, material);

    // Add to the scene
    addMeshToScene('niiVolume', geometry, material);
  };

  const [isLoading, setIsLoading] = useState(false);

  const handleNiiUpload = async (event) => {
    setIsLoading(true); // Show spinner
    try {
      const file = event.target.files[0];
      if (!file) {
        throw new Error('No file selected');
      }

      // Read the file as an ArrayBuffer
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const fileData = e.target.result;

          // Validate if the file is a valid NIfTI file
          if (!nifti.isNIFTI(fileData)) {
            throw new Error('File is not a valid NIfTI file');
          }

          const header = nifti.readHeader(fileData);
          let image = nifti.readImage(header, fileData);
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

          // Transform to MNI coordinates using affine matrix
          const affineMatrix = header.affine;
          const mniCoordinates = voxelCoordinates.map(([x, y, z, value]) => {
            const voxelHomogeneous = [x, y, z, 1]; // Add 1 for homogeneous transformation
            const transformedVoxels = math.multiply(
              affineMatrix,
              voxelHomogeneous,
            );
            const [wx, wy, wz] = transformedVoxels.slice(0, 3);
            return [wx, wy, wz, value];
          });

          console.log('MNI Coordinates:', mniCoordinates);

          // plotNifti(mniCoordinates);
          // Set the state with the transformed coordinates
          setNiiCoords(mniCoordinates);
          handleNiiMap(mniCoordinates);
          // setIsLoading(false); // Hide spinner
        } catch (error) {
          console.error('Error processing NIfTI file:', error);
          // setIsLoading(false); // Hide spinner
        } finally {
          setIsLoading(false); // Hide spinner
        }
      };

      reader.onerror = () => {
        console.error('Failed to read file');
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error loading NIfTI file:', error);
    } finally {
      setIsLoading(false); // Hide spinner
      // Reset the file input value to allow re-uploading the same file
      event.target.value = null;
    }
  };

  // useEffect(() => {
  //   const mainWindow = remote.getCurrentWindow();
  //   if (open) {
  //     // Increase the window height when the Collapse is open
  //     mainWindow.setSize(mainWindow.getSize()[0], mainWindow.getSize()[1] + 300);
  //   } else {
  //     // Decrease the window height when the Collapse is closed
  //     mainWindow.setSize(mainWindow.getSize()[0], mainWindow.getSize()[1] - 300);
  //   }
  // }, [open]);

  // useEffect(() => {
  //   // Example: Resize window to 1024x768 on component load
  //   window.electron.ipcRenderer.sendMessage('resize-window', 1024, 768);
  // }, []);

  // Don't forget this

  // useEffect(() => {
  //   window.electron.zoom.setZoomLevel(-3);
  // }, []);

  const [searchCoordinate, setSearchCoordinate] = useState('');
  const [matchingAtlases, setMatchingAtlases] = useState([]);

  // load-ply-file-2 is basically jsust used for the coordinate within which atlas functionality
  const handleCoordinateSearch = async () => {
    if (!searchCoordinate) {
      alert('Please enter a valid coordinate.');
      return;
    }

    // Parse the coordinate input (assuming comma-separated x, y, z)
    const [x, y, z] = searchCoordinate.split(',').map(Number);
    if ([x, y, z].some(isNaN)) {
      alert('Please enter valid numeric coordinates in the format x,y,z.');
      return;
    }

    const loader = new PLYLoader();
    const matchingFiles = [];

    const fileData = await window.electron.ipcRenderer.invoke(
      'load-ply-file-2',
      '',
    );

    const niiFilesPassed = [];

    console.log('fileData: ', fileData);

    const checkCoord = (path, fileBuffer) => {
      const header = nifti.readHeader(fileBuffer);
      let image = nifti.readImage(header, fileBuffer);
      console.log(image);
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
        if (image.byteLength % 4 !== 0) {
          const padding = 4 - (image.byteLength % 4);
          const paddedArray = new Uint8Array(image.byteLength + padding);
          paddedArray.set(new Uint8Array(image));
          image = paddedArray.buffer;
        }
        image = new Float32Array(image);
      }
      // Apply scaling factors
      const { scl_slope = 1, scl_inter = 0 } = header;
      const img = new Float32Array(
        image.map((value) => value * scl_slope + scl_inter),
      );

      // Extract dimensions
      const dimensions = header.dims.slice(1, 4);

      // Generate voxel coordinates
      const voxelCoordinates = [];
      const threshold = 0.5; // Define your threshold value here
      img.forEach((value, index) => {
        if (!Number.isNaN(value)) {
          const z = Math.floor(index / (dimensions[0] * dimensions[1]));
          const y = Math.floor(
            (index % (dimensions[0] * dimensions[1])) / dimensions[0],
          );
          const x = index % dimensions[0];
          // const binarizedValue = value >= threshold ? 1 : 0; // Binarize the value based on the threshold
          voxelCoordinates.push([x, y, z, value]);
        }
      });
      const affineMatrix = header.affine;
      const inverseAffineMatrix = math.inv(affineMatrix);
      const newSearchCoordinate = [
        parseFloat(searchCoordinate.split(',')[0]),
        parseFloat(searchCoordinate.split(',')[1]),
        parseFloat(searchCoordinate.split(',')[2]),
        1,
      ];
      console.log(searchCoordinate);
      console.log(newSearchCoordinate);
      const transformedCoordinates = math.multiply(
        inverseAffineMatrix,
        newSearchCoordinate,
      );

      console.log(transformedCoordinates);
      const roundedCoordinates = transformedCoordinates.map((coord) =>
        Math.round(coord),
      );
      console.log(roundedCoordinates);
      // Find the value of the roundedCoordinates in voxelCoordinates
      const [roundedX, roundedY, roundedZ] = roundedCoordinates;
      console.log(roundedX, roundedY, roundedZ);
      Object.keys(voxelCoordinates).forEach((key) => {
        if (
          voxelCoordinates[key][0] === roundedX &&
          voxelCoordinates[key][1] === roundedY &&
          voxelCoordinates[key][2] === roundedZ
        ) {
          console.log('Found: ', voxelCoordinates[key][3]);
        }
      });

      const findVoxelValue = (targetX, targetY, targetZ) => {
        // Find the index of the voxel with the specified coordinates
        const index = voxelCoordinates.findIndex(
          ([x, y, z]) => x === targetX && y === targetY && z === targetZ,
        );

        // If the voxel is found, return the value; otherwise, return null or an appropriate message
        if (index !== -1) {
          return voxelCoordinates[index][3]; // Assuming the value is at the 4th position
        }
        return null; // Or handle the case where the voxel is not found
      };

      const value = findVoxelValue(
        roundedX,
        roundedY,
        roundedZ,
        voxelCoordinates,
      );
      console.log('Value at rounded coordinates:', value);

      const matchingVoxel = voxelCoordinates.find((voxel) => {
        const [x, y, z] = voxel;
        return x === roundedX && y === roundedY && z === roundedZ;
      });
      console.log(matchingVoxel);
      if (matchingVoxel) {
        const value = matchingVoxel[3];
        console.log('Value at rounded coordinates:', value);
      } else {
        // If no exact match is found, find the nearest neighbor
        const findNearestNeighbor = (target, coordinates) => {
          let nearest = null;
          let minDistance = Infinity;

          coordinates.forEach(([x, y, z, value]) => {
            const distance = Math.sqrt(
              (x - target[0]) ** 2 +
                (y - target[1]) ** 2 +
                (z - target[2]) ** 2,
            );

            if (distance < minDistance) {
              minDistance = distance;
              nearest = [x, y, z, value];
            }
          });

          return nearest;
        };

        const nearestVoxel = findNearestNeighbor(
          roundedCoordinates,
          voxelCoordinates,
        );

        if (nearestVoxel) {
          const value = nearestVoxel[3];
          if (value !== 0) {
            niiFilesPassed.push(path);
          }
          console.log('Value at nearest coordinates:', value);
        } else {
          console.log('No nearby voxel found.');
        }
      }
      console.log(matchingFiles);
    };

    const processFile = async (file) => {
      const { filePath } = file;
      const fileBuffer = await window.electron.ipcRenderer.invoke(
        'load-file-buffer',
        filePath,
      );
      console.log('filePath: ', filePath);
      checkCoord(filePath, fileBuffer);
    };

    const processFilesSequentially = async () => {
      for (const file of fileData) {
        const { fileName } = file;
        if (fileName !== 'gm_mask.nii.gz') {
          await processFile(file);
        }
      }
    };

    // Call the function to process files one at a time
    processFilesSequentially(fileData);

    // await Promise.all(
    //   fileData.map(async (file) => {
    //     const { filePath } = file;
    //     const fileBuffer = await window.electron.ipcRenderer.invoke(
    //       'load-file-buffer',
    //       filePath,
    //     );
    //     console.log('filePath: ', filePath);
    //     checkCoord(filePath, fileBuffer);
    //   }),
    // );
    console.log('niiFilesPassed: ', niiFilesPassed);
    // const header = nifti.readHeader(fileData);
    // let image = nifti.readImage(header, fileData);
    // console.log(image);
    // console.log('Header: ', header);
    // // Ensure `image` is a valid ArrayBuffer
    // if (!(image instanceof ArrayBuffer)) {
    //   console.log('Adjusting image to ArrayBuffer...');
    //   image = new Uint8Array(image).buffer;
    // }

    // // Handle endian mismatch
    // if (!header.littleEndian) {
    //   console.warn('File is in big-endian format. Adjusting...');
    //   const dataView = new DataView(image);
    //   const correctedData = new Float32Array(image.byteLength / 4);
    //   for (let i = 0; i < correctedData.length; i++) {
    //     correctedData[i] = dataView.getFloat32(i * 4, false); // false = big-endian
    //   }
    //   image = correctedData;
    // } else {
    //   if (image.byteLength % 4 !== 0) {
    //     const padding = 4 - (image.byteLength % 4);
    //     const paddedArray = new Uint8Array(image.byteLength + padding);
    //     paddedArray.set(new Uint8Array(image));
    //     image = paddedArray.buffer;
    //   }
    //   image = new Float32Array(image);
    // }
    // console.log(image);
    // // Apply scaling factors
    // const { scl_slope = 1, scl_inter = 0 } = header;
    // const img = new Float32Array(
    //   image.map((value) => value * scl_slope + scl_inter),
    // );

    // // Extract dimensions
    // const dimensions = header.dims.slice(1, 4);
    // console.log('Dimensions:', dimensions);

    // // Generate voxel coordinates
    // const voxelCoordinates = [];
    // const threshold = 0.5; // Define your threshold value here
    // img.forEach((value, index) => {
    //   if (!Number.isNaN(value)) {
    //     const z = Math.floor(index / (dimensions[0] * dimensions[1]));
    //     const y = Math.floor(
    //       (index % (dimensions[0] * dimensions[1])) / dimensions[0],
    //     );
    //     const x = index % dimensions[0];
    //     // const binarizedValue = value >= threshold ? 1 : 0; // Binarize the value based on the threshold
    //     voxelCoordinates.push([x, y, z, value]);
    //   }
    // });
    // console.log(voxelCoordinates);
    // const affineMatrix = header.affine;
    // const inverseAffineMatrix = math.inv(affineMatrix);
    // const newSearchCoordinate = [
    //   parseFloat(searchCoordinate.split(',')[0]),
    //   parseFloat(searchCoordinate.split(',')[1]),
    //   parseFloat(searchCoordinate.split(',')[2]),
    //   1,
    // ];
    // console.log(searchCoordinate);
    // console.log(newSearchCoordinate);
    // const transformedCoordinates = math.multiply(
    //   inverseAffineMatrix,
    //   newSearchCoordinate,
    // );

    // console.log(transformedCoordinates);
    // const roundedCoordinates = transformedCoordinates.map((coord) =>
    //   Math.round(coord),
    // );
    // console.log(roundedCoordinates);
    // // Find the value of the roundedCoordinates in voxelCoordinates
    // const [roundedX, roundedY, roundedZ] = roundedCoordinates;
    // console.log(roundedX, roundedY, roundedZ);
    // Object.keys(voxelCoordinates).forEach((key) => {

    //   if (voxelCoordinates[key][0] === roundedX && voxelCoordinates[key][1] === roundedY && voxelCoordinates[key][2] === roundedZ) {
    //     console.log('Found: ', voxelCoordinates[key][3]);
    //   }
    // });

    // const findVoxelValue = (targetX, targetY, targetZ) => {
    //   // Find the index of the voxel with the specified coordinates
    //   const index = voxelCoordinates.findIndex(([x, y, z]) => x === targetX && y === targetY && z === targetZ);

    //   // If the voxel is found, return the value; otherwise, return null or an appropriate message
    //   if (index !== -1) {
    //     return voxelCoordinates[index][3]; // Assuming the value is at the 4th position
    //   } else {
    //     return null; // Or handle the case where the voxel is not found
    //   }
    // };

    // const value = findVoxelValue(roundedX, roundedY, roundedZ, voxelCoordinates);
    // console.log('Value at rounded coordinates:', value);

    // const matchingVoxel = voxelCoordinates.find((voxel) => {
    //   const [x, y, z] = voxel;
    //   return x === roundedX && y === roundedY && z === roundedZ;
    // });
    // console.log(matchingVoxel);
    // if (matchingVoxel) {
    //   const value = matchingVoxel[3];
    //   console.log('Value at rounded coordinates:', value);
    // } else {
    //   // If no exact match is found, find the nearest neighbor
    //   const findNearestNeighbor = (target, coordinates) => {
    //     let nearest = null;
    //     let minDistance = Infinity;

    //     coordinates.forEach(([x, y, z, value]) => {
    //       const distance = Math.sqrt(
    //         Math.pow(x - target[0], 2) +
    //         Math.pow(y - target[1], 2) +
    //         Math.pow(z - target[2], 2)
    //       );

    //       if (distance < minDistance) {
    //         minDistance = distance;
    //         nearest = [x, y, z, value];
    //       }
    //     });

    //     return nearest;
    //   };

    //   const nearestVoxel = findNearestNeighbor(roundedCoordinates, voxelCoordinates);

    //   if (nearestVoxel) {
    //     const value = nearestVoxel[3];
    //     console.log('Value at nearest coordinates:', value);
    //   } else {
    //     console.log('No nearby voxel found.');
    //   }
    // }
    // console.log(matchingFiles);
    // setMatchingAtlases(matchingFiles);
  };

  const isCoordinateInGeometry = (x, y, z, geometry) => {
    const vertices = geometry.attributes.position.array;

    // Check if the input coordinate is near any vertex
    for (let i = 0; i < vertices.length; i += 3) {
      const [vx, vy, vz] = [vertices[i], vertices[i + 1], vertices[i + 2]];
      const tolerance = 0.3; // Adjust tolerance as needed
      if (
        Math.abs(vx - x) <= tolerance &&
        Math.abs(vy - y) <= tolerance &&
        Math.abs(vz - z) <= tolerance
      ) {
        return true;
      }
    }
    return false;
  };

  // Function to convert NIfTI data to a mesh using marching cubes
  const convertNiftiToMesh = async (
    niftiData,
    threshold = 0.5,
    colorMap = 'rainbow',
  ) => {
    try {
      // Validate if the file is a valid NIfTI file
      if (!nifti.isNIFTI(niftiData)) {
        throw new Error('File is not a valid NIfTI file');
      }

      const header = nifti.readHeader(niftiData);
      let image = nifti.readImage(header, niftiData);

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
      console.log('img: ', img);
      // Create a 3D array for the marching cubes algorithm
      const [dimX, dimY, dimZ] = dimensions;
      const data = new Float32Array((dimX * dimY * dimZ) / 2);

      // Copy the image data to the 3D array
      for (let i = 0; i < img.length; i++) {
        data[i] = img[i];
      }
      console.log('data: ', data);
      // Find min and max values for normalization
      // Apply arctan normalization to all values
      // for (let i = 0; i < data.length; i++) {
      //   data[i] = Math.atan(data[i]);
      // }
      let minValue = Infinity;
      let maxValue = -Infinity;
      for (let i = 0; i < data.length; i++) {
        if (data[i] < minValue) minValue = data[i];
        if (data[i] > maxValue) maxValue = data[i];
      }
      console.log(`Data range: ${minValue} to ${maxValue}`);

      // Normalize data to [0, 1] range
      for (let i = 0; i < data.length; i++) {
        data[i] = (data[i] - minValue) / (maxValue - minValue);
      }
      for (let i = 0; i < data.length; i++) {
        if (data[i] < minValue) minValue = data[i];
        if (data[i] > maxValue) maxValue = data[i];
      }
      console.log(`Data range: ${minValue} to ${maxValue}`);
      console.log('Running Marching Cubes...');
      // console.log('Isosurface: ', isosurface);
      const vol = new Float32Array(image.buffer);
      // const vox = ndarray(vol, dims);
      // Generate surface mesh using Marching Cubes algorithm
      // const isoLevel = 1;
      // const mesh = iso.marchingCubes(
      //   dims,
      //   (x, y, z) => vox.get(x, y, z) - isoLevel   // signed distance
      // );
      const [nx, ny, nz] = header.dims.slice(1, 4); // volume dims
      const isoLevel = 0.5; // surface value

      // ---------- marching cubes WITHOUT ndarray ----------
      const scalar = (x, y, z) => {
        return vol[x + nx * (y + ny * z)] - isoLevel; // <‑‑ direct indexing
      };

      const mesh = iso.marchingCubes([nx, ny, nz], scalar);
      console.log('Mesh: ', mesh);

      if (mesh.positions.length === 0) {
        throw new Error(
          'No surface extracted. Check data values and threshold.',
        );
      }

      // Create a Three.js geometry from the marching cubes mesh
      const geometry = new THREE.BufferGeometry();

      // Add positions
      const positions = new Float32Array(mesh.positions.flat());
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3),
      );

      // Add faces (indices)
      const indices = new Uint32Array(mesh.cells.flat());
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));

      // Compute vertex normals
      geometry.computeVertexNormals();

      // Create colors based on intensity values
      const colors = new Float32Array(mesh.positions.length * 3);
      const color = new THREE.Color();

      // For each vertex, find its corresponding intensity value
      for (let i = 0; i < mesh.positions.length; i++) {
        const [x, y, z] = mesh.positions[i];

        // Find the closest voxel in the original data
        const voxelX = Math.floor(x);
        const voxelY = Math.floor(y);
        const voxelZ = Math.floor(z);

        // Make sure we're within bounds
        if (
          voxelX >= 0 &&
          voxelX < dimX &&
          voxelY >= 0 &&
          voxelY < dimY &&
          voxelZ >= 0 &&
          voxelZ < dimZ
        ) {
          const index = voxelX + dimX * (voxelY + dimY * voxelZ);
          const intensity = data[index];

          // Normalize intensity to [0, 1]
          const normalizedIntensity =
            (intensity - minValue) / (maxValue - minValue);

          // Map intensity to color based on the selected color map
          switch (colorMap) {
            case 'rainbow':
              color.setHSL(0.7 * (1 - normalizedIntensity), 1, 0.5);
              break;
            case 'grayscale':
              color.setRGB(
                normalizedIntensity,
                normalizedIntensity,
                normalizedIntensity,
              );
              break;
            case 'red':
              color.setRGB(normalizedIntensity, 0, 0);
              break;
            case 'green':
              color.setRGB(0, normalizedIntensity, 0);
              break;
            case 'blue':
              color.setRGB(0, 0, normalizedIntensity);
              break;
            default:
              color.setHSL(0.7 * (1 - normalizedIntensity), 1, 0.5);
          }
        } else {
          // Default color for out-of-bounds vertices
          color.setRGB(0.5, 0.5, 0.5);
        }

        // Set the color for this vertex
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }

      // Add colors to the geometry
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      // Create a material for the mesh
      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        flatShading: false, // Use smooth shading for better back-face visibility
        side: THREE.DoubleSide, // Render both sides so visible from any angle
        // Add emissive to ensure visibility even when not directly lit
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0.1,
      });
      geometry.computeVertexNormals(); // Ensure normals are computed for proper lighting on both sides

      return { geometry, material };
    } catch (error) {
      console.error('Error converting NIfTI to mesh:', error);
      return null;
    }
  };

  // Builds an overlay surface from a raw NIfTI buffer (nii2Mesh handles
  // gzip-compressed volumes internally) and adds it to the scene. The buffer
  // is retained so the surface can be rebuilt when smoothing changes.
  const importNiftiOverlay = (overlayName, buffer) => {
    const { geometry, material } = nii2Mesh(buffer, {
      smoothingIterations: surfaceSmoothing,
    });
    material.color.set(
      OVERLAY_COLOR_PALETTE[
        overlayColorIndexRef.current % OVERLAY_COLOR_PALETTE.length
      ],
    );
    overlayColorIndexRef.current += 1;
    niftiSourcesRef.current[overlayName] = buffer;
    addMeshToScene(overlayName, geometry, material);
  };

  const onDrop = async (acceptedFiles) => {
    const niftiFiles = acceptedFiles.filter((file) =>
      NIFTI_FILE_PATTERN.test(file.name),
    );
    if (niftiFiles.length === 0) {
      setImportStatus({
        type: 'error',
        message: 'Only NIfTI volumes (.nii or .nii.gz) can be imported here.',
      });
      return;
    }

    const imported = [];
    const failed = [];
    // Sequential on purpose: marching cubes is CPU-heavy and parallel imports
    // would just fight over the main thread.
    for (const file of niftiFiles) {
      const overlayName = stripNiftiExtension(file.name);
      try {
        // eslint-disable-next-line no-await-in-loop
        const buffer = await file.arrayBuffer();
        importNiftiOverlay(overlayName, buffer);
        imported.push(overlayName);
      } catch (error) {
        console.error(`Failed to import NIfTI overlay ${file.name}:`, error);
        failed.push(overlayName);
      }
    }

    if (failed.length > 0) {
      setImportStatus({
        type: 'error',
        message: `Could not import: ${failed.join(', ')}. Check that the file is a valid NIfTI volume.`,
      });
    } else {
      setImportStatus({
        type: 'info',
        message: `Added ${imported.join(', ')} to the scene.`,
      });
    }
  };

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open: openNiftiFileDialog,
  } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    accept: {
      'application/octet-stream': ['.nii'],
      'application/gzip': ['.gz'],
    },
  });

  // Auto-dismiss import notifications.
  useEffect(() => {
    if (!importStatus) return undefined;
    const timer = setTimeout(() => setImportStatus(null), 6000);
    return () => clearTimeout(timer);
  }, [importStatus]);

  // Rebuild imported overlay surfaces when the smoothing level changes,
  // keeping each mesh's material (color/opacity) untouched. Debounced so
  // dragging the slider doesn't re-run marching cubes on every tick.
  useEffect(() => {
    const sources = Object.entries(niftiSourcesRef.current);
    if (sources.length === 0) return undefined;
    const timer = setTimeout(() => {
      const scene = sceneRef.current;
      if (!scene) return;
      sources.forEach(([overlayName, buffer]) => {
        const existing: any = scene.children.find(
          (child) => child.name === overlayName,
        );
        if (!existing) return;
        try {
          const rebuilt = nii2Mesh(buffer, {
            smoothingIterations: surfaceSmoothing,
          });
          existing.geometry?.dispose?.();
          existing.geometry = rebuilt.geometry;
          rebuilt.material.dispose();
        } catch (error) {
          console.error(`Failed to re-smooth overlay ${overlayName}:`, error);
        }
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [surfaceSmoothing]);

  // Keep the scene background in sync with the selected color.
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(backgroundColor);
    }
  }, [backgroundColor, sceneReady]);

  const visibleSceneBounds = () => {
    const scene = sceneRef.current;
    if (!scene) return null;
    const box = new THREE.Box3();
    let hasContent = false;
    scene.children.forEach((child: any) => {
      if (!child.isMesh || !child.visible) return;
      box.expandByObject(child);
      hasContent = true;
    });
    return hasContent && !box.isEmpty() ? box : null;
  };

  // Snap the main camera to a standard anatomical viewing direction, framed
  // around the reconstruction (or, failing that, whatever is in the scene).
  const applyViewPreset = (directionArray, upArray) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera) return;

    const reconstruction = reconstructionCameraBounds();
    let center = reconstruction?.center ?? null;
    let radius = reconstruction ? reconstruction.size.length() / 2 : 0;
    if (!center) {
      const box = visibleSceneBounds();
      if (!box) return;
      center = box.getCenter(new THREE.Vector3());
      radius = box.getSize(new THREE.Vector3()).length() / 2;
    }

    const distance = Math.max(50, radius * 3);
    const direction = new THREE.Vector3(...directionArray).normalize();
    camera.up.set(...upArray);
    camera.position.copy(
      center.clone().add(direction.multiplyScalar(distance)),
    );
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.copy(center);
      controls.update();
    }
  };

  const resetPrimaryView = () => {
    applyViewPreset([0, -1, 1], [0, 0, 1]);
  };

  const captureScreenshot = () => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!renderer || !camera || !scene) return;
    // Render immediately before reading pixels: the drawing buffer is not
    // preserved between frames.
    renderer.render(scene, camera);
    const link = document.createElement('a');
    link.download = `lead-viewer-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.png`;
    link.href = renderer.domElement.toDataURL('image/png');
    link.click();
  };

  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleFullScreen = () => {
    const renderer = rendererRef.current;
    renderer.setSize(
      Math.min(window.innerWidth, window.innerHeight),
      Math.min(window.innerWidth, window.innerHeight),
    );
    const baseWidth = 500; // Base width
    const baseHeight = 500; // Base height
    const aspectRatio = baseWidth / baseHeight;

    // Calculate the frustum size based on the desired aspect ratio
    const frustumSize = 45; // Adjust this value to control zoom

    // Calculate the left, right, top, and bottom based on the aspect ratio
    const left = (frustumSize * aspectRatio) / -2;
    const right = (frustumSize * aspectRatio) / 2;
    const top = frustumSize / 2;
    const bottom = frustumSize / -2;

    // Initialize the OrthographicCamera
    const camera = new THREE.OrthographicCamera(
      left, // left
      right, // right
      top, // top
      bottom, // bottom
      0.1, // near plane
      1000, // far plane
    );
    // cameraRef.current = camera;
    setIsFullScreen(!isFullScreen);
  };

  const [isFrozen, setIsFrozen] = useState(false); // New state for freeze functionality

  const toggleFreeze = () => {
    setIsFrozen((prev) => !prev);
    if (controlsRef.current) {
      controlsRef.current.enabled = !isFrozen; // Disable controls if frozen
    }
    // Add logic here to disable/enable camera controls based on the isFrozen state
  };

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = !isFrozen; // Update controls based on freeze state
    }
  }, [isFrozen]);

  const handleMouseHover = (event) => {
    if (isFrozen) {
      console.log('Mouse is hovering over the scene');
      // Add your custom logic here
    }
  };
  const [val, setVal] = useState(-10);
  const handleSlideSlice = (val_import) => {
    let zVal = val + val_import / 100;
    console.log('zVal: ', zVal);
    const { mniCoordinates, header, voxelCoordinates } = slice;
    const [nx, ny, nz] = header.dims.slice(1, 4);
    const plotCoords = [];
    for (let i = 0; i < mniCoordinates.length; i++) {
      const [x, y, z, value] = mniCoordinates[i];
      if (z === zVal) {
        plotCoords.push([x, y, zVal, value]); // z is 0 for a 2D plane
      }
    }
    console.log('plotCoords: ', plotCoords);
    const values = plotCoords.map(([x, y, z, value]) => value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const meanValue = values.reduce((acc, val) => acc + val, 0) / values.length;
    console.log(
      'Max Value: ',
      maxValue,
      'Mean Value: ',
      meanValue,
      'Min Value: ',
      minValue,
    );
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
        uSlice: { value: 0 }, // Uniform to select the slice
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
      `,
    });

    // Create the mesh
    const mesh = new THREE.Mesh(geometry, material);
    const position = [0, 0, zVal];

    addMeshToScene('NIfTI Volume', mesh.geometry, mesh.material, position);
  };

  const handleZoom = (event) => {
    if (isFrozen) {
      console.log('Zoom action detected');
      // Add your custom logic here
      handleSlideSlice(event.deltaY / 100);
      console.log(event.deltaY);
    }
  };

  // Add event listeners when the component mounts
  useEffect(() => {
    const rendererElement = rendererRef.current?.domElement;
    if (!rendererElement) return undefined;

    const onMouseMove = (event) => {
      handleMouseHover(event);
    };

    const onWheel = (event) => {
      handleZoom(event);
    };

    // rendererElement.addEventListener('mousemove', onMouseMove);
    rendererElement.addEventListener('wheel', onWheel);

    // Clean up event listeners on component unmount
    return () => {
      // rendererElement.removeEventListener('mousemove', onMouseMove);
      rendererElement.removeEventListener('wheel', onWheel);
    };
  }, [isFrozen, sceneReady]);

  const handleKeyPress = (event) => {
    if (event.key === 'Escape') {
      setIsFullScreen(false);
    }
  };

  // Add keydown event listener when the component mounts
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);

    // Clean up event listener on component unmount
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  return (
    <div style={{ marginTop: '-120px' }}>
      <div style={isFullScreen ? fullScreenStyle : viewerContainerStyle}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* <IconButton
            onClick={toggleFullScreen}
            style={{ position: 'absolute', top: 20, right: 20, zIndex: 1000, color: 'white' }}
          >
            {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton> */}
          {/* <IconButton
            onClick={toggleFreeze}
            style={{ position: 'absolute', top: 20, right: 60, zIndex: 1000, color: 'white' }} // Adjusted position
          >
            {isFrozen ? <LockOpenIcon /> : <LockIcon />}
          </IconButton> */}

          <div
            {...getRootProps()}
            style={{ position: 'relative' }}
            data-testid="nifti-dropzone"
          >
            <input {...getInputProps()} />
            <div style={viewerToolbarStyle}>
              {VIEW_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  title={preset.title}
                  style={viewerToolbarButtonStyle}
                  onClick={() => applyViewPreset(preset.direction, preset.up)}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                title="Reset view"
                style={viewerToolbarButtonStyle}
                onClick={resetPrimaryView}
              >
                ⟲
              </button>
              <button
                type="button"
                title="Save screenshot (PNG)"
                style={viewerToolbarButtonStyle}
                onClick={captureScreenshot}
              >
                ⬇
              </button>
            </div>
            <div
              ref={mountRef}
              style={{
                borderRadius: '15px',
                // Adjust size based on full-screen state
                width: isFullScreen ? '100vw' : 'auto',
                height: isFullScreen ? '100vh' : 'auto',
              }}
            />
            <div ref={secondaryMountRef} />
            {isDragActive && (
              <div style={dropOverlayStyle}>
                Drop NIfTI volumes (.nii / .nii.gz) to add them to the scene
              </div>
            )}
            {importStatus && (
              <div
                role="status"
                style={
                  importStatus.type === 'error'
                    ? importErrorToastStyle
                    : importInfoToastStyle
                }
              >
                {importStatus.message}
              </div>
            )}
          </div>
          {electrodeGeometryStatus === 'fallback' && (
            <div role="status" style={geometryStatusStyle}>
              Generic electrode model (PLY unavailable)
            </div>
          )}
          {electrodeGeometryStatus === 'empty' && (
            <div role="alert" style={geometryErrorStyle}>
              Electrode geometry is unavailable. Reopen the patient in Lead-DBS
              to regenerate its reconstruction coordinates or PLY export.
            </div>
          )}
        </div>
        <Dropdown drop="start" style={{ zIndex: 1001 }}>
          <Dropdown.Toggle variant="secondary" style={{ marginLeft: '-100px' }}>
            <SettingsIcon />
          </Dropdown.Toggle>
          <Dropdown.Menu
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)', // Slightly more opaque for better readability
              border: '1px solid rgba(0, 0, 0, 0.1)', // Light border for definition
              borderRadius: '8px', // Rounded corners for a softer look
              padding: '10px', // Padding for spacing
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)', // Subtle shadow for depth
              zIndex: 1001,
            }}
          >
            <div id="tabs-collapse">
              <Tabs
                defaultActiveKey="meshes"
                id="mesh-controls-tab"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)', // Consistent background color
                  borderRadius: '8px', // Match the dropdown menu
                  padding: '10px', // Consistent padding
                }}
              >
                <Tab eventKey="meshes" title="Meshes">
                  <div style={controlPanelStyle}>
                    {meshes.map((mesh, index) => (
                      <div key={mesh.name} style={meshControlStyle}>
                        <h5 style={meshNameStyle}>{mesh.name}</h5>
                        <h3 style={{ fontSize: '12px', color: '#333' }}>
                          Visibility
                        </h3>
                        <Form.Check
                          type="switch"
                          checked={meshProperties[mesh.name]?.visible}
                          onChange={() => handleVisibilityChange(mesh.name)}
                        />
                        <h3 style={{ fontSize: '12px', color: '#333' }}>
                          Opacity
                        </h3>
                        <Form.Range
                          min={0}
                          max={1}
                          step={0.01}
                          value={meshProperties[mesh.name]?.opacity || 0.8}
                          onChange={(e) =>
                            handleOpacityChange(
                              mesh.name,
                              parseFloat(e.target.value),
                            )
                          }
                          style={{ width: '150px' }}
                        />
                        {meshProperties[mesh.name]?.color && (
                          <>
                            <h3 style={{ fontSize: '12px', color: '#333' }}>
                              Color
                            </h3>
                            <Form.Control
                              type="color"
                              value={meshProperties[mesh.name].color}
                              onChange={(e) =>
                                handleMeshColorChange(
                                  mesh.name,
                                  e.target.value,
                                )
                              }
                              style={{ width: '60px', padding: '2px' }}
                            />
                          </>
                        )}
                        {!ELECTRODE_MESH_NAMES.has(mesh.name) && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            style={{ marginTop: '8px' }}
                            onClick={() => handleRemoveMesh(mesh.name)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </Tab>
                <Tab eventKey="display" title="Display">
                  <div style={controlPanelStyle}>
                    <h5 style={meshNameStyle}>Background</h5>
                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        alignItems: 'center',
                      }}
                    >
                      {BACKGROUND_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          title={preset.label}
                          aria-label={`${preset.label} background`}
                          onClick={() => setBackgroundColor(preset.value)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            border:
                              backgroundColor === preset.value
                                ? '2px solid #4b9fe0'
                                : '1px solid #999',
                            backgroundColor: preset.value,
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                      <Form.Control
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        style={{ width: '48px', padding: '2px' }}
                      />
                    </div>
                    <h5 style={{ ...meshNameStyle, marginTop: '16px' }}>
                      Structure smoothing
                    </h5>
                    <div style={{ fontSize: '12px', color: '#333' }}>
                      Smooths imported NIfTI surfaces (Taubin,{' '}
                      {surfaceSmoothing} iteration
                      {surfaceSmoothing === 1 ? '' : 's'})
                    </div>
                    <Form.Range
                      min={0}
                      max={15}
                      step={1}
                      value={surfaceSmoothing}
                      onChange={(e) =>
                        setSurfaceSmoothing(parseInt(e.target.value, 10))
                      }
                      style={{ width: '150px' }}
                    />
                    <h5 style={{ ...meshNameStyle, marginTop: '16px' }}>
                      NIfTI overlays
                    </h5>
                    <div style={{ fontSize: '12px', color: '#333' }}>
                      Drag and drop .nii / .nii.gz files onto the viewer, or
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      style={{ marginTop: '8px', width: '150px' }}
                      onClick={openNiftiFileDialog}
                    >
                      Import NIfTI…
                    </Button>
                  </div>
                </Tab>
                {plyFiles.length > 0 && (
                  <Tab eventKey="atlases" title="Atlases">
                    <div style={controlPanelStyle2}>
                      <select
                        onChange={handleFileChange}
                        multiple
                        style={{
                          height: '500px',
                          width: '300px',
                          backgroundColor: 'rgba(255, 255, 255, 0.8)', // Consistent background color
                          border: '1px solid rgba(0, 0, 0, 0.1)', // Light border
                          borderRadius: '8px', // Rounded corners
                          padding: '5px', // Padding for spacing
                        }}
                      >
                        {plyFiles.map((file, index) => (
                          <option key={index} value={index}>
                            {file.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Tab>
                )}
                {/* <Tab eventKey="priorStims" title="Patient Database">
                  <div style={controlPanelStyle2}>
                    <select
                      onChange={handlePriorStimChange}
                      multiple
                      style={{
                        height: '500px',
                        width: '300px',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)', // Consistent background color
                        border: '1px solid rgba(0, 0, 0, 0.1)', // Light border
                        borderRadius: '8px', // Rounded corners
                        padding: '5px', // Padding for spacing
                      }}
                    >
                      {priorStims &&
                        Object.keys(priorStims).map((patientId, index) => (
                          <optgroup key={index} label={patientId}>
                            {priorStims[patientId].map(
                              (session, sessionIndex) => (
                                <option
                                  key={`${patientId}-${sessionIndex}`}
                                  value={`${patientId}-${session}`}
                                >
                                  {session}
                                </option>
                              ),
                            )}
                          </optgroup>
                        ))}
                    </select>
                  </div>
                </Tab> */}

                <Tab eventKey="sweetspots" title="Sweetspots">
                  <Tabs defaultActiveKey="tremor" id="nested-tabs-inside">
                    <Tab eventKey="tremor" title="Tremor">
                      <div style={controlPanelStyle2}>
                        <select
                          onChange={handleTremorChange}
                          multiple
                          style={{
                            height: '500px',
                            width: '300px',
                            backgroundColor: 'rgba(255, 255, 255, 0.8)', // Consistent background color
                            border: '1px solid rgba(0, 0, 0, 0.1)', // Light border
                            borderRadius: '8px', // Rounded corners
                            padding: '5px', // Padding for spacing
                          }}
                        >
                          {tremorData.map((tremor, index) => (
                            <option key={index} value={index}>
                              {tremor.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="primary"
                          onClick={() => setShowModal(true)}
                        >
                          Add Coordinates
                        </Button>
                        <Modal
                          show={showModal}
                          onHide={() => setShowModal(false)}
                        >
                          <Modal.Header closeButton>
                            <Modal.Title>Add New Coordinates</Modal.Title>
                          </Modal.Header>
                          <Modal.Body>
                            <input
                              type="text"
                              name="name"
                              placeholder="Name"
                              value={newTremor.name}
                              onChange={handleNewTremorChange}
                              className="form-control"
                            />
                            <input
                              type="number"
                              name="coords"
                              placeholder="X"
                              value={newTremor.coords[0]}
                              onChange={(e) =>
                                setNewTremor({
                                  ...newTremor,
                                  coords: [
                                    e.target.value,
                                    newTremor.coords[1],
                                    newTremor.coords[2],
                                  ],
                                })
                              }
                              className="form-control mt-2"
                            />
                            <input
                              type="number"
                              name="coords"
                              placeholder="Y"
                              value={newTremor.coords[1]}
                              onChange={(e) =>
                                setNewTremor({
                                  ...newTremor,
                                  coords: [
                                    newTremor.coords[0],
                                    e.target.value,
                                    newTremor.coords[2],
                                  ],
                                })
                              }
                              className="form-control mt-2"
                            />
                            <input
                              type="number"
                              name="coords"
                              placeholder="Z"
                              value={newTremor.coords[2]}
                              onChange={(e) =>
                                setNewTremor({
                                  ...newTremor,
                                  coords: [
                                    newTremor.coords[0],
                                    newTremor.coords[1],
                                    e.target.value,
                                  ],
                                })
                              }
                              className="form-control mt-2"
                            />
                          </Modal.Body>
                          <Modal.Footer>
                            <Button
                              variant="secondary"
                              onClick={() => setShowModal(false)}
                            >
                              Close
                            </Button>
                            <Button variant="primary" onClick={addNewTremor}>
                              Add
                            </Button>
                          </Modal.Footer>
                        </Modal>
                      </div>
                    </Tab>
                    <Tab eventKey="pd" title="PD">
                      <div style={controlPanelStyle2}>
                        <select
                          onChange={handlePDChange}
                          multiple
                          style={{
                            height: '500px',
                            width: '300px',
                            backgroundColor: 'rgba(255, 255, 255, 0.8)', // Consistent background color
                            border: '1px solid rgba(0, 0, 0, 0.1)', // Light border
                            borderRadius: '8px', // Rounded corners
                            padding: '5px', // Padding for spacing
                          }}
                        >
                          {pdData.map((tremor, index) => (
                            <option key={index} value={index}>
                              {tremor.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="primary"
                          onClick={() => setShowPDModal(true)}
                        >
                          Add Coordinates
                        </Button>
                        <Modal
                          show={showPDModal}
                          onHide={() => setShowPDModal(false)}
                        >
                          <Modal.Header closeButton>
                            <Modal.Title>Add New Coordinates</Modal.Title>
                          </Modal.Header>
                          <Modal.Body>
                            <input
                              type="text"
                              name="name"
                              placeholder="Name"
                              value={newPD.name}
                              onChange={handleNewPDChange}
                              className="form-control"
                            />
                            <input
                              type="number"
                              name="coords"
                              placeholder="X"
                              value={newPD.coords[0]}
                              onChange={(e) =>
                                setNewPD({
                                  ...newPD,
                                  coords: [
                                    e.target.value,
                                    newPD.coords[1],
                                    newPD.coords[2],
                                  ],
                                })
                              }
                              className="form-control mt-2"
                            />
                            <input
                              type="number"
                              name="coords"
                              placeholder="Y"
                              value={newPD.coords[1]}
                              onChange={(e) =>
                                setNewTremor({
                                  ...newPD,
                                  coords: [
                                    newPD.coords[0],
                                    e.target.value,
                                    newPD.coords[2],
                                  ],
                                })
                              }
                              className="form-control mt-2"
                            />
                            <input
                              type="number"
                              name="coords"
                              placeholder="Z"
                              value={newPD.coords[2]}
                              onChange={(e) =>
                                setNewTremor({
                                  ...newPD,
                                  coords: [
                                    newPD.coords[0],
                                    newPD.coords[1],
                                    e.target.value,
                                  ],
                                })
                              }
                              className="form-control mt-2"
                            />
                          </Modal.Body>
                          <Modal.Footer>
                            <Button
                              variant="secondary"
                              onClick={() => setShowPDModal(false)}
                            >
                              Close
                            </Button>
                            <Button variant="primary" onClick={addNewPD}>
                              Add
                            </Button>
                          </Modal.Footer>
                        </Modal>
                      </div>
                    </Tab>
                  </Tabs>
                </Tab>
                <Tab eventKey="solution" title="Automatic Solution">
                  <div style={controlPanelStyle2}>
                    <h3 style={{ fontSize: '14px', color: '#333' }}>
                      Optimize for:
                    </h3>
                    <select
                      id="options"
                      style={{
                        width: '200px',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)', // Consistent background color
                        border: '1px solid rgba(0, 0, 0, 0.1)', // Light border
                        borderRadius: '8px', // Rounded corners
                        padding: '5px', // Padding for spacing
                      }}
                      value={roi}
                      onChange={handleRoiChange}
                    >
                      <optgroup label="Tremor Data">
                        {tremorData.map((tremor, index) => (
                          <option
                            key={`tremor-${index}`}
                            value={`tremor-${index}`}
                          >
                            {tremor.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="PD Data">
                        {pdData.map((pd, index) => (
                          <option key={`pd-${index}`} value={`pd-${index}`}>
                            {pd.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <div>
                      <Button variant="primary" onClick={handleSTNParameters}>
                        Provide Solution
                      </Button>
                    </div>
                    <h3 style={{ fontSize: '14px', color: '#333' }}>Avoid:</h3>
                    <select
                      id="options"
                      style={{
                        width: '200px',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)', // Consistent background color
                        border: '1px solid rgba(0, 0, 0, 0.1)', // Light border
                        borderRadius: '8px', // Rounded corners
                        padding: '5px', // Padding for spacing
                      }}
                      value={avoidRoi}
                      onChange={handleAvoidanceRoiChange}
                    >
                      <optgroup label="Tremor Data">
                        {tremorData.map((tremor, index) => (
                          <option
                            key={`tremor-${index}`}
                            value={`tremor-${index}`}
                          >
                            {tremor.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="PD Data">
                        {pdData.map((pd, index) => (
                          <option key={`pd-${index}`} value={`pd-${index}`}>
                            {pd.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginTop: '10px',
                      }}
                    >
                      <div>
                        <Button variant="primary" onClick={handleAvoidance}>
                          Avoid
                        </Button>
                      </div>
                      <div>
                        <Button
                          variant="primary"
                          onClick={() =>
                            document.getElementById('nifti-upload').click()
                          }
                          className="mb-4 mx-2"
                        >
                          Import NIfTI File and Provide Solution
                        </Button>
                        <input
                          id="nifti-upload"
                          type="file"
                          style={{ display: 'none' }}
                          accept=".nii"
                          onChange={(e) => handleNiiUpload(e)}
                        />
                        {isLoading && (
                          <div className="d-flex justify-content-center mt-3">
                            <div
                              className="spinner-border text-primary"
                              role="status"
                            >
                              <span className="visually-hidden">
                                Loading...
                              </span>
                            </div>
                          </div>
                        )}
                        {/* <span>{niiSolution}</span>
                        <Button onClick={saveCurrentSpheres}>
                          Save Spheres
                        </Button>
                        <Button
                          onClick={() =>
                            calculatePercentOverlap(savedSpheres.current)
                          }
                        >
                          Compare Overlap
                        </Button> */}
                      </div>
                    </div>
                  </div>
                </Tab>
              </Tabs>
            </div>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </div>
  );
}

const dropzoneStyle = {
  position: 'absolute', // Overlay on top of other elements
  top: 0,
  // left: 0,
  right: 0,
  bottom: 0,
  height: '500px',
  border: 'transparent',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'auto', // Ensure it doesn't interfere with underlying elements
  cursor: 'pointer',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  color: 'transparent',
};

const viewerToolbarStyle: React.CSSProperties = {
  position: 'absolute',
  top: '10px',
  left: '10px',
  zIndex: 500,
  display: 'flex',
  gap: '4px',
};

const viewerToolbarButtonStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  padding: 0,
  border: '1px solid rgba(255, 255, 255, 0.25)',
  borderRadius: '6px',
  backgroundColor: 'rgba(30, 38, 46, 0.75)',
  color: '#d9e2ec',
  fontSize: '13px',
  lineHeight: 1,
  cursor: 'pointer',
};

const dropOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '20px',
  borderRadius: '15px',
  border: '2px dashed #4b9fe0',
  backgroundColor: 'rgba(20, 32, 44, 0.75)',
  color: '#d9e2ec',
  fontSize: '16px',
  pointerEvents: 'none',
};

const importInfoToastStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '10px',
  left: '10px',
  right: '10px',
  zIndex: 600,
  padding: '6px 10px',
  borderRadius: '8px',
  backgroundColor: 'rgba(27, 67, 50, 0.9)',
  color: '#d8f3dc',
  fontSize: '12px',
  textAlign: 'center',
  pointerEvents: 'none',
};

const importErrorToastStyle: React.CSSProperties = {
  ...importInfoToastStyle,
  backgroundColor: 'rgba(120, 30, 30, 0.9)',
  color: '#ffe3e3',
};

const viewerContainerStyle = {
  display: 'flex',
  flexDirection: 'row', // Ensures that the viewer and controls are side-by-side
  alignItems: 'flex-start', // Align the controls to the top of the viewer
  justifyContent: 'space-between',
  height: '100%', // Adjust to fit the full height of the container
  width: '100%',
};

const geometryStatusStyle = {
  color: '#d9e2ec',
  backgroundColor: 'rgba(44, 62, 80, 0.9)',
  fontSize: '12px',
  lineHeight: 1.4,
  padding: '6px 10px',
  textAlign: 'center',
};

const geometryErrorStyle = {
  ...geometryStatusStyle,
  color: '#ffe8cc',
  backgroundColor: 'rgba(120, 53, 15, 0.95)',
  maxWidth: '500px',
};

const controlPanelStyle2 = {
  display: 'flex',
  flexDirection: 'column', // Stack controls vertically
  width: '300px', // Fixed width for the control panel
  height: '600px',
  padding: '10px',
  border: 'none',
  // backgroundColor: '#f5f5f5',
  // backgroundColor: 'transparent', // Semi-transparent background color
  backgroundColor: 'rgba(255, 255, 255, 0.44)',
};

const controlPanelStyle = {
  display: 'flex',
  flexDirection: 'column', // Stack controls vertically
  maxHeight: '600px', // Matches the height of the viewer
  overflowY: 'auto', // Allows scrolling if controls exceed height
  width: '300px', // Fixed width for the control panel
  // border: '1px solid #ccc',
  border: 'none',
  borderRadius: '8px',
  // boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
  padding: '20px',
  // backgroundColor: 'transparent', // Semi-transparent background color
  backgroundColor: 'rgba(255, 255, 255, 0.44)',
  // backgroundColor: 'green',
};

const meshControlStyle = {
  marginBottom: '20px', // Space between each mesh control
};

const meshNameStyle = {
  fontSize: '16px',
  fontWeight: 'bold',
  marginBottom: '10px', // Add space below the mesh name
  // backgroundColor: 'rgba(245, 245, 245, 0.2)', // Semi-transparent background color
  backgroundColor: 'rgba(255, 255, 255, 0.44)',
};

const fullScreenStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '80vw',
  height: '80vh',
  zIndex: 1000, // Ensure it is on top of other elements
  backgroundColor: 'white', // Optional: Set a background color
};

export default PlyViewer;
