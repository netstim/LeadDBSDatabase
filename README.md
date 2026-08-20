
# Lead-DBS Programmer Tool

The **Lead-DBS Programmer Tool** is an Electron React desktop application designed to facilitate the management and visualization of Deep Brain Stimulation (DBS) parameters, patient data, and clinical outcomes. Integrating seamlessly with the Lead-DBS framework, this tool provides researchers and clinicians with an intuitive interface for exploring stimulation settings, modeling Volumes of Tissue Activation (VTAs), and tracking clinical scores across multiple time points.

## Features

- **Interactive Electrode Modeling**  
  Visualize DBS electrodes in 3D and simulate VTAs in real-time. Supports directional and nondirectional electrodes, allowing precise control over stimulation parameters such as amplitude, pulse width, and contact activation.

- **BIDS-Like Data Structure**  
  Organizes patient data in a standardized, reproducible format, including stimulation parameters, clinical scores (e.g., UPDRS, BFMDRS, TRS, YGTSS, YBOCS), and timeline-based data points (e.g., `baseline`, `3months`, `6months`).

- **Clinical Score Tracking**  
  Manage and analyze clinical outcomes over time. Supports importing clinical data from JSON and Excel files with automatic mapping to stimulation parameters.

- **Lead-DBS Integration**  
  Imports electrode reconstructions from Lead-DBS, enabling visualization of patient-specific VTAs relative to brain structures, sweetspots, and atlases.

- **Customizability**  
  Add and manage custom clinical scores, stimulation parameters, and data visualizations. Features include creating and managing custom tables, sorting patients by attributes like age or gender, and visualizing data with advanced filters.

- **User-Friendly Interface**  
  Designed for ease of use, mimicking clinical programming tools with an intuitive layout for electrode and stimulation parameter management.

- **Cross-Platform**  
  Available for Windows, macOS, and Linux.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/SavirMadan13/lead-dbs-programmer.git
   cd lead-dbs-programmer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

4. Build for distribution (optional):
   ```bash
   npm run package
   ```
