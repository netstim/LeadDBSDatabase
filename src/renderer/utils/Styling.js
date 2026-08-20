// StyleContext.js
import React, { createContext, useState } from 'react';

export const StyleContext = createContext();

export function Styling({ children }) {
  const [style, setStyle] = useState({ marginTop: '0px' });

  return (
    <StyleContext.Provider value={{ style, setStyle }}>
      {children}
    </StyleContext.Provider>
  );
}

export default Styling;
