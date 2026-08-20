/**
 * Patient Context
 * 
 * This context provides global state management for patient data across
 * the application. It allows components to access and update the patient
 * list without prop drilling.
 */

import React, { createContext, useState } from 'react';

// Type definitions for better TypeScript support
interface Patient {
  id: string;
  name?: string;
  // Add other patient properties as needed
}

interface PatientContextType {
  patients: Patient[];
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
}

// Create the context with proper typing
export const PatientContext = createContext<PatientContextType | undefined>(undefined);

// Provider component props interface
interface PatientProviderProps {
  children: React.ReactNode;
}

/**
 * PatientProvider Component
 * 
 * Provides patient context to all child components. Manages the global
 * patient state and provides methods to update it.
 */
export function PatientProvider({ children }: PatientProviderProps) {
  const [patients, setPatients] = useState<Patient[]>([]);

  return (
    <PatientContext.Provider value={{ patients, setPatients }}>
      {children}
    </PatientContext.Provider>
  );
}
