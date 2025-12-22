import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import * as THREE from 'three';
import { PLYLoader, OrbitControls } from 'three-stdlib';
// import * as nifti from 'nifti-reader-js'; // Correctly importing the nifti module
import * as nifti from 'nifti-reader-js';
// import './electrode_models/currentModels/ElecModelStyling/boston_vercise_directed.css';
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
import SettingsIcon from '@mui/icons-material/Settings'; // Material UI settings icon
import * as math from 'mathjs';
// import BigBrain from '../../assets/images/untitled.jpg';
// import { remote } from 'electron'; // Use 'electron' for Electron v12+

function GroupViewer({
  filteredPatients,
  directoryPath,
  filters,
}) {
  const [plyFile, setPlyFile] = useState(null);
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
  // Thresholding/Modification stuff

  // Don't forget **********************
  // useEffect(() => {
  //   // This loads in the combined electrodes for the selected patient
  //   const loadPlyFile = async () => {
  //     try {
  //       const fileData = await window.electron.ipcRenderer.invoke(
  //         'load-ply-file',
  //         historical,
  //       );
  //       // setPlyFile(fileData);
  //       const loader = new PLYLoader();
  //       const geometry = loader.parse(fileData);

  //       const material = new THREE.MeshStandardMaterial({
  //         vertexColors: geometry.hasAttribute('color'),
  //         flatShading: true,
  //         metalness: 0.1, // More reflective
  //         roughness: 0.5, // Shinier surface
  //         transparent: true, // Enable transparency
  //         opacity: 0.8, // Set opacity to 60%
  //       });
  //       // eslint-disable-next-line no-use-before-define
  //       addMeshToScene('Electrode Scene', geometry, material);
  //     } catch (error) {
  //       console.error('Error loading PLY file:', error);
  //     }
  //   };

  //   loadPlyFile(); // Call the async function
  // }, []);

  console.log('Filtered Patients: ', filteredPatients);
  console.log('Filters: ', filters);
  const publicationColors = {
    'Hollunder 2024': '#F4C27A', // Soft Orange
    'Rajamani 2024': '#5A9EAE', // Teal Blue
    'Irmen 2020': '#8A9A95', // Muted Green
    'Meyer 2023': '#F28C82', // Soft Coral
    'Sobesky 2022': '#92A8D1', // Light Blue
    'Li 2020': '#F0E68C', // Khaki
    'Li 2021': '#FFB347', // Apricot
    'Horn 2022': '#B565A7', // Lavender
    'Horn 2017': '#009688', // Teal
    'Other': '#B0B0B0', // Light Gray
    // Add more publications and colors as needed
  };

  // useEffect(() => {
  //   // This loads the anatomy.ply scene
  //   const loadPlyFile = async () => {
  //     const historical = {
  //       patient: filteredPatients[0],
  //       timeline: 'none',
  //       directoryPath,
  //       leadDBS: true,
  //     };
  //     try {
  //       const fileData = await window.electron.ipcRenderer.invoke(
  //         'load-ply-file-anatomy',
  //         historical,
  //       );
  //       // setPlyFile(fileData);
  //       const loader = new PLYLoader();
  //       const geometry = loader.parse(fileData);


  //       const material = new THREE.MeshStandardMaterial({
  //         vertexColors: geometry.hasAttribute('color'),
  //         flatShading: true,
  //         metalness: 0.1, // More reflective
  //         roughness: 0.5, // Shinier surface
  //         transparent: true, // Enable transparency
  //         opacity: 0.8, // Set opacity to 60%
  //       });
  //       // eslint-disable-next-line no-use-before-define
  //       addMeshToScene('Anatomy', geometry, material);
  //     } catch (error) {
  //       console.error('Error loading PLY file:', error);
  //     }
  //   };

  //   loadPlyFile(); // Call the async function
  // }, []);

  useEffect(() => {
    // This loads the anatomy.ply scene
    const loadPlyFile = async () => {
      const historical = {
        patient: filteredPatients[0],
        timeline: 'none',
        directoryPath,
        leadDBS: true,
      };
      try {
        const fileData = await window.electron.ipcRenderer.invoke(
          'load-ply-file-anatomy',
          historical,
        );
        const loader = new PLYLoader();
        const geometry = loader.parse(fileData);

        // Access the color attribute
        const colors = geometry.attributes.color.array;
        const newColors = new Float32Array(colors.length * 4 / 3);

        // Iterate over the colors and make reddish tones transparent
        for (let i = 0, j = 0; i < colors.length; i += 3, j += 4) {
          const r = colors[i];
          const g = colors[i + 1];
          const b = colors[i + 2];

          newColors[j] = r;
          newColors[j + 1] = g;
          newColors[j + 2] = b;

          // Check if the color is reddish
          if (r > 0.5 && g < 0.3 && b < 0.3) {
            newColors[j + 3] = 0; // Set alpha to 0 for transparency
          } else {
            newColors[j + 3] = 1; // Fully opaque
          }
        }

        geometry.setAttribute('color', new THREE.BufferAttribute(newColors, 4));

        const material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          flatShading: true,
          metalness: 0.1,
          roughness: 0.5,
          transparent: true,
        });

        // eslint-disable-next-line no-use-before-define
        addMeshToScene('Anatomy', geometry, material);
      } catch (error) {
        console.error('Error loading PLY file:', error);
      }
    };

    loadPlyFile(); // Call the async function
  }, []);


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
    { name: 'Avoidance coordinate - test', coords: [12.73, -14.36, -6.7] },
    { name: 'Cognition < 65', coords: [14.3, -13.7, -3.7] },
    { name: 'Cognition > 65', coords: [7.3, -10.2, -11.7] },
    { name: 'Gait', coords: [6.2, -8.3, -9.7] },
  ]);

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

  // useEffect(() => {
  //   // Gathers atlases
  //   const fetchPlyFiles = async () => {
  //     try {
  //       // Request the PLY file paths from the main process using invoke/handle
  //       const files = await window.electron.ipcRenderer.invoke('get-ply-files');
  //       // Store both the file name and the full path in the state
  //       const fileData = files.map((file) => ({
  //         name: file.fileName.split('/').pop(), // Extract the atlas name from the path
  //         path: file.filePath, // Store the full path
  //       }));
  //       console.log(fileData);
  //       setPlyFiles(fileData);
  //     } catch (error) {
  //       console.error('Error fetching PLY files:', error);
  //     }
  //   };

  //   fetchPlyFiles();
  // }, []); // Empty dependency array ensures this runs only on mount

  const [priorStims, setPriorStims] = useState(null);

  const [selectedFilePath, setSelectedFilePath] = useState(''); // Selected file path

  const addMeshToScene = (name, geometry, material, position) => {
    const scene = sceneRef.current;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; // Assign the name for reference
    if (position) {
      const [x, y, z] = position;
      mesh.position.set(x, y, z); // Set the position of the mesh
    }
    scene.add(mesh);

    setMeshes((prevMeshes) => [...prevMeshes, mesh]); // Add mesh to state
    setMeshProperties((prevProps) => ({
      ...prevProps,
      [name]: { visible: true, opacity: 0.8 },
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
        flatShading: true,
        metalness: 0.1,
        roughness: 0.5,
        transparent: true,
        opacity: 0.8,
      });

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
      mesh.material.transparent = true;
    }
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
  };

  function getRandomColor() {
    return Math.floor(Math.random() * 16777215); // Generate a random number between 0 and 0xFFFFFF
  }

  const getColor = (patient) => {
    const filter = 'Netstim / CBCT Publications';
    let color = publicationColors['Other'];
    const publication = patient[filter] ? patient[filter].split(',').map(p => p.trim()) : null;
    if (filters[filter] && filters[filter].length > 0) {
      console.log('Publication: ', publication);
      const selectedPublication = filters[filter];
      if (publication && publication.includes(selectedPublication)) {
        color = publicationColors[selectedPublication];
      } else if (publication.length >= 1) {
        color = publicationColors[publication[0]];
      }
    } else if (publication) {
      console.log('Publication: ', publication);
      if (publication.length >= 1) {
        color = publicationColors[publication[0]];
        console.log('Color: ', color);
      } else {
        color = publicationColors[publication];
      }
    }
    return color;
  };

  const handlePriorStimChange = async (outputPatientID, color) => {
    const electrodeLoader = new PLYLoader();

    try {
      // Load and parse the PLY file from Electron's IPC
      const fileData = await window.electron.ipcRenderer.invoke(
        'load-reconstruction',
        outputPatientID,
        directoryPath,
      );
      const electrodeGeometry = electrodeLoader.parse(
        fileData.combinedElectrodesPly,
      );

      const colors = electrodeGeometry.attributes.color.array; // Access the existing color array

      // Create a new colors array
      const newColors = new Float32Array(colors.length);

      // Define the RGB values for light grey
      const lightGrey = [0.7, 0.7, 0.75]; // Slightly bluish-grey for a more metallic look
      // Iterate over the colors array and replace yellow-like colors with light grey
      for (let i = 0; i < colors.length; i += 3) {
        const r = colors[i];
        const g = colors[i + 1];
        const b = colors[i + 2];

        // Check if the color is close to yellow, lime green, magenta, or cyan
        if (
          (r > 0.9 && g > 0.9 && b < 0.6) || // Yellow-like
          (r > 0.4 && r < 0.6 && g > 0.9 && b < 0.1) || // Lime green-like
          (r > 0.9 && g < 0.1 && b > 0.4 && b < 0.6) || // Magenta-like
          (r < 0.1 && g > 0.4 && g < 0.6 && b > 0.9) || // Cyan-like
          (r < 0.1 && g < 0.1 && b > 0.4 && b < 0.6) || // Blue-like
          (r < 0.1 && g < 0.1 && b > 0.5 && b < 0.6) ||
          (b > 0.5 && b > r && b > g) // General blue-like
        ) {
          // If the color matches any of the specified colors, change it to light grey
          newColors[i] = lightGrey[0];
          newColors[i + 1] = lightGrey[1];
          newColors[i + 2] = lightGrey[2];
        } else {
          // Otherwise, keep the original color
          newColors[i] = r;
          newColors[i + 1] = g;
          newColors[i + 2] = b;
        }
      }

      // Update the geometry with the new colors
      electrodeGeometry.setAttribute('color', new THREE.BufferAttribute(newColors, 3));


      // Create a material for the mesh
      const material = new THREE.MeshStandardMaterial({
        vertexColors: electrodeGeometry.hasAttribute('color'),
        metalness: 0, // High metalness for a metallic look
        roughness: 0.1, // Low roughness for a shiny surface
        transparent: false,
        opacity: 1,
        emissive: new THREE.Color(0x333333), // Add a slight emissive color for subtle glow
        emissiveIntensity: 0.6, // Set emissive intensity
      });

      // Add the mesh to the scene
      addMeshToScene(
        `${outputPatientID}-electrodes`,
        electrodeGeometry,
        material,
      );
    } catch (error) {
      console.error('Error loading PLY file:', error);
    }
  };

  useEffect(() => {
    if (sceneRef.current && mountRef.current) {
      // Remove all previously rendered patients
      console.log('Loading electrodes');
      sceneRef.current.children = sceneRef.current.children.filter(
        (child) => !child.name.includes('-electrodes')
      );

      // Render the filtered patients
      filteredPatients.forEach((patient) => {
        const color = getColor(patient);
        if (patient.id === 'sub-CbctDbs0215') {
          return;
        }
        handlePriorStimChange(patient.id, color);
      });
    }
  }, [filteredPatients, sceneRef.current, mountRef.current]);

  // useEffect(() => {
  //   if (mountRef.current && secondaryMountRef.current) {
  //     // Initialize scene, camera, and renderer only once
  //     const scene = new THREE.Scene();
  //     sceneRef.current = scene; // Save scene reference
  //     scene.background = new THREE.Color(0xffffff); // White background

  //     // Create an OrthographicCamera
  //     const aspect = 500 / 500;
  //     const frustumSize = 45; // Adjust this value to control zoom
  //     const camera = new THREE.OrthographicCamera(
  //       (frustumSize * aspect) / -2, // left
  //       (frustumSize * aspect) / 2, // right
  //       frustumSize / 2, // top
  //       frustumSize / -2, // bottom
  //       0.1, // near plane
  //       1000, // far plane
  //     );

  //     // Secondary Camera Setup
  //     const secondaryWidth = 500;
  //     const secondaryHeight = 250; // Adjust height as needed
  //     const aspectSecondary = secondaryWidth / secondaryHeight;
  //     const secondaryFrustumHeight = frustumSize; // Set a smaller height for the secondary view
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
  //     renderer.setSize(500, 500);
  //     mountRef.current.appendChild(renderer.domElement);

  //     const secondaryRenderer = new THREE.WebGLRenderer({ antialias: true });
  //     secondaryRenderer.setSize(500, 250);
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

  //     camera.position.set(0, -50, 50); // Zoomed out to start

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
  // }, []);


  useEffect(() => {
    if (mountRef.current) {
      // Initialize scene, camera, and renderer only once
      const scene = new THREE.Scene();
      sceneRef.current = scene; // Save scene reference
      scene.background = new THREE.Color(0xffffff); // White background

      // Create an OrthographicCamera
      // const aspect = 500 / 500;
      // const frustumSize = 45; // Adjust this value to control zoom
      // const camera = new THREE.OrthographicCamera(
      //   (frustumSize * aspect) / -2, // left
      //   (frustumSize * aspect) / 2, // right
      //   frustumSize / 2, // top
      //   frustumSize / -2, // bottom
      //   0.1, // near plane
      //   1000, // far plane
      // );

      // const renderer = new THREE.WebGLRenderer({ antialias: true });
      // renderer.setSize(500, 500);
      // mountRef.current.appendChild(renderer.domElement);

      // const ambientLight = new THREE.AmbientLight(0xffffff, 1);
      // scene.add(ambientLight);

      // const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      // directionalLight.position.set(5, 5, 5).normalize();
      // scene.add(directionalLight);

      const aspect = 1200 / 800; // Set a wider aspect ratio
      const frustumSize = 45; // Adjust this value to control zoom
      const camera = new THREE.OrthographicCamera(
        (frustumSize * aspect) / -2, // left
        (frustumSize * aspect) / 2, // right
        frustumSize / 2, // top
        frustumSize / -2, // bottom
        0.1, // near plane
        1000, // far plane
      );

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(1200, 800); // Set a wider size for the renderer
      mountRef.current.appendChild(renderer.domElement);

      // const ambientLight = new THREE.AmbientLight(0xffffff, 1.5); // Reduced intensity
      // scene.add(ambientLight);

      // const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Reduced intensity
      // directionalLight.position.set(-5, -5, 5).normalize();
      // scene.add(directionalLight);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Lower intensity
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Adjust intensity
      directionalLight.position.set(5, 5, 5).normalize();
      scene.add(directionalLight);

      // Add a PointLight for more dynamic lighting
      const pointLight = new THREE.PointLight(0xff0000, 1, 100); // Red light
      pointLight.position.set(10, 10, 10);
      scene.add(pointLight);

      // Add a HemisphereLight for a more natural lighting effect
      const hemisphereLight = new THREE.HemisphereLight(0x4040ff, 0x404040, 0.5); // Blue sky, grey ground
      scene.add(hemisphereLight);

      const spotLight = new THREE.SpotLight(0xffffff, 1);
      spotLight.position.set(15, 20, 10);
      spotLight.angle = Math.PI / 6; // Adjust the angle of the spotlight
      spotLight.penumbra = 0.1; // Soft edges
      spotLight.decay = 2; // Light decay over distance
      spotLight.distance = 200; // Maximum range of the light
      scene.add(spotLight);

      // Add a RectAreaLight for soft, even lighting
      const rectLight = new THREE.RectAreaLight(0xffffff, 2, 10, 10);
      rectLight.position.set(5, 5, 5);
      rectLight.lookAt(0, 0, 0); // Point the light towards the center of the scene
      scene.add(rectLight);

      // OrbitControls setup (only initialize once)
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.rotateSpeed = 0.8;
      controls.zoomSpeed = 0.5;
      controlsRef.current = controls;

      camera.position.set(0, -50, 50); // Zoomed out to start

      rendererRef.current = renderer;
      cameraRef.current = camera;

      const animate = () => {
        requestAnimationFrame(animate);
        controls.update(); // Update OrbitControls
        renderer.render(sceneRef.current, camera);
      };
      animate();

      // Load the image as a texture
      const textureLoader = new THREE.TextureLoader();
      // textureLoader.load(BigBrain, (texture) => {
      //   // Create a plane geometry
      //   const aspectRatio = texture.image.width / texture.image.height;

      //   // Create a plane geometry with the correct aspect ratio
      //   const planeGeometry = new THREE.PlaneGeometry(256 * aspectRatio, 256);

      //   const planeMaterial = new THREE.MeshBasicMaterial({ map: texture });
      //   const plane = new THREE.Mesh(planeGeometry, planeMaterial);

      //   // Position the plane in the scene
      //   plane.position.set(0, -15, -10); // Adjust position as needed
      //   scene.add(plane);
      // });

      return () => {
        renderer.dispose();
      };
    }
  }, []);

  useEffect(() => {
    if (atlas && sceneRef.current) {
      const scene = sceneRef.current;
      const loader = new PLYLoader();
      const geometry = loader.parse(atlas);
      const material = new THREE.MeshStandardMaterial({
        vertexColors: geometry.hasAttribute('color'),
        flatShading: true,
        metalness: 0.1,
        roughness: 0.5,
        transparent: true,
        opacity: 0.8,
      });

      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
    }
  }, [atlas]);

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
        const {fileName } = file;
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

  return (
    <div style={{ marginTop: '-120px' }}>
      {/* {!plyFile && (
        <div {...getRootProps({ className: 'dropzone' })} style={dropzoneStyle}>
          <input {...getInputProps()} />
          <p>Drag & drop a .ply file here</p>
        </div>
      )} */}
      <div style={viewerContainerStyle}>
        {/* <div ref={mountRef} /> */}
        {/* <Button onClick={changeCameraAngle}>View from top</Button> */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div ref={mountRef} />
          {/* <div ref={secondaryMountRef} /> */}
        </div>
        <Dropdown drop="start">
          <Dropdown.Toggle variant="secondary" style={{ marginLeft: '-100px' }}>
            <SettingsIcon />
          </Dropdown.Toggle>
          <Dropdown.Menu
            style={{ backgroundColor: 'transparent', border: 'none' }}
          >
            <div id="tabs-collapse">
              <Tabs
                defaultActiveKey="meshes"
                id="mesh-controls-tab"
                // className="mb-3"
                style={{ backgroundColor: 'transparent' }}
              >
                <Tab eventKey="meshes" title="Meshes">
                  <div style={controlPanelStyle}>
                    {meshes.map((mesh, index) => (
                      <div key={mesh.name} style={meshControlStyle}>
                        <h5 style={meshNameStyle}>{mesh.name}</h5>
                        <h3 style={{ fontSize: '12px' }}>Visibility</h3>
                        <Form.Check
                          type="switch"
                          checked={meshProperties[mesh.name]?.visible}
                          onChange={() => handleVisibilityChange(mesh.name)}
                        />
                        <h3 style={{ fontSize: '12px' }}>Opacity</h3>
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
                      </div>
                    ))}
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
  // width: '100%',
  height: '150px',
  border: '3px dashed #007bff',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  // backgroundColor: '#f8f9fa',
  transition: 'background-color 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
  marginBottom: '20px',
  cursor: 'pointer',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
};

const viewerContainerStyle = {
  display: 'flex',
  flexDirection: 'row', // Ensures that the viewer and controls are side-by-side
  alignItems: 'flex-start', // Align the controls to the top of the viewer
  justifyContent: 'space-between',
  height: '100%', // Adjust to fit the full height of the container
  width: '100%',
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
  backgroundColor: 'rgba(255, 255, 255, 0.84)',
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

export default GroupViewer;
