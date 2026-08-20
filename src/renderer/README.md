# Lead-DBS Programmer - Renderer Process

This directory contains the renderer process code for the Lead-DBS Programmer application, built with React, TypeScript, and Electron.

## 📁 Directory Structure

```
src/renderer/
├── App.tsx                 # Main application component
├── App.css                 # Global application styles
├── index.tsx              # Renderer process entry point
├── index.ejs              # HTML template
├── preload.d.ts           # TypeScript definitions for preload script
├── components/            # React components
│   ├── PatientContext.tsx # Global patient state management
│   ├── Navbar.tsx         # Navigation component
│   ├── PatientDatabase.js # Patient database management
│   ├── PatientDetails.js  # Individual patient details
│   ├── Programmer.tsx     # Main programming interface
│   └── ...                # Other components
└── niivue/               # NiiVue viewer integration
    └── ui/               # NiiVue UI components
```

## 🏗️ Architecture Overview

### Main Components

#### App.tsx
The root component that manages:
- Application routing using React Router
- Global state for directory selection and settings
- IPC communication with the main process
- Window management and zoom controls

#### PatientContext.tsx
Provides global state management for patient data across the application:
- Patient list management
- Context provider for child components
- TypeScript interfaces for type safety

#### Navbar.tsx
Responsive navigation component with:
- Material-UI integration
- Optional secondary title bar
- Mobile-responsive design

#### Programmer.tsx
Main programming interface featuring:
- Stimulation parameter configuration
- Electrode model management
- Data import/export functionality
- Support for both individual and group programming modes

### Key Features

1. **Type Safety**: Comprehensive TypeScript integration with proper interfaces
2. **State Management**: React Context for global state, local state for component-specific data
3. **Responsive Design**: Material-UI components with mobile support
4. **IPC Communication**: Secure communication with Electron main process
5. **Modular Architecture**: Well-organized components with clear separation of concerns

## 🎨 Styling

The application uses a combination of:
- **App.css**: Global styles with organized sections
- **Component-specific CSS**: Individual stylesheets for complex components
- **Material-UI**: Consistent component styling and theming
- **Bootstrap**: Additional utility classes

### CSS Organization
- Base styles for typography and layout
- Component-specific styles grouped by functionality
- Interactive elements with hover states and transitions
- Responsive design considerations

## 🔧 Development Guidelines

### Code Organization
1. **Imports**: Grouped by type (React, third-party, local)
2. **Type Definitions**: Interfaces defined at the top of files
3. **State Management**: Clear separation of local and global state
4. **Functions**: Well-documented with JSDoc comments
5. **JSX**: Organized with clear comments for different sections

### TypeScript Usage
- All components use TypeScript interfaces
- Proper typing for props, state, and function parameters
- Generic types for reusable components
- Strict type checking enabled

### Component Structure
```typescript
// 1. Imports (grouped)
// 2. Type definitions
// 3. Component function with proper typing
// 4. State management
// 5. Event handlers
// 6. Effects
// 7. Render JSX
```

## 🚀 Getting Started

### Prerequisites
- Node.js and npm
- Electron development environment
- TypeScript compiler

### Development
1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
3. Build for production: `npm run build`

## 📝 Recent Refactoring

The renderer process has been recently refactored to improve:
- **Code Organization**: Better file structure and import organization
- **Type Safety**: Comprehensive TypeScript integration
- **Documentation**: Extensive JSDoc comments and README files
- **CSS Organization**: Structured stylesheets with clear sections
- **Component Architecture**: Cleaner component structure and separation of concerns

## 🔍 Key Improvements

1. **TypeScript Migration**: Converted JavaScript files to TypeScript with proper typing
2. **Documentation**: Added comprehensive comments and documentation
3. **Code Cleanup**: Removed commented code and improved readability
4. **CSS Organization**: Structured stylesheets with clear sections and comments
5. **Component Refactoring**: Improved component structure and prop handling
6. **State Management**: Better organization of state and context usage

## 🐛 Troubleshooting

### Common Issues
1. **TypeScript Errors**: Ensure all interfaces are properly defined
2. **Import Issues**: Check import paths and file extensions
3. **State Management**: Verify context providers are properly wrapped
4. **Styling Issues**: Check CSS specificity and class names

### Debug Tips
- Use React DevTools for component debugging
- Check browser console for TypeScript errors
- Verify IPC communication in Electron DevTools
- Test responsive design at different screen sizes

## 📚 Additional Resources

- [React Documentation](https://reactjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Material-UI Components](https://mui.com/components)
- [Electron Documentation](https://www.electronjs.org/docs)