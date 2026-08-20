import { useEffect, useRef, useState, useCallback } from 'react';
import { Niivue } from '@niivue/niivue';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { NiivueCanvas } from '../niivue/ui/components/NiivueCanvas'; // Adjust the import path as necessary

function NiiViewer() {
  const nv = useRef(new Niivue()).current;
  const [meshes, setMeshes] = useState([]);
  const [volumes, setVolumes] = useState([]);

  // // useEffect(() => {
  // //   nv.opts.multiplanarForceRender = true;

  // //   // Commented out the volume loading code
  // //   // Example: Load a sample MRI volume
    // nv.loadVolumes([
    //   {
    //     url: 'https://niivue.github.io/niivue-demo-images/mni152.nii.gz',
    //     name: 'mesh',
    //   },
    // ]).then(() =>
    //   setVolumes(nv.volumes.map((vol, index) => ({ name: vol.name, index }))),
    // );

  // //   return () => nv.destroy();
  // // }, []);

  // Add Mesh
  const addMesh = useCallback(async (url, name) => {
    await nv.addMeshFromUrl({ url, name });
    setMeshes(nv.meshes.map((mesh, index) => ({ name: mesh.name, index })));
  }, []);

  // Remove Mesh
  const removeMesh = useCallback((index) => {
    nv.removeMesh(nv.meshes[index]);
    setMeshes(nv.meshes.map((mesh, idx) => ({ name: mesh.name, idx })));
  }, []);

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap={2}
      sx={{ width: '100%', height: '100vh' }}
    >
      {/* Control Buttons */}
      <Box display="flex" gap={2}>
        <Button
          variant="contained"
          onClick={() =>
            addMesh(
              'https://niivue.github.io/niivue-demo-images/brain_mesh.obj',
              'Brain Mesh',
            )
          }
        >
          Add Mesh
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => meshes.length > 0 && removeMesh(meshes.length - 1)}
        >
          Remove Last Mesh
        </Button>
      </Box>

      {/* Niivue Canvas */}
      <NiivueCanvas nv={nv} style={{ width: '80%', height: '80vh', border: '1px solid gray' }} />
    </Box>
  );
}

export default NiiViewer;
