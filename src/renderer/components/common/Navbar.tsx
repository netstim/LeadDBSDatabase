/**
 * Navbar Component
 * 
 * A responsive navigation bar component that displays the application title
 * and can optionally show a secondary title bar. It uses Material-UI components
 * for consistent styling and responsive behavior.
 */

import React, { useState } from 'react';
import {
  AppBar,
  Drawer,
  IconButton,
  List,
  ListItem,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { NavLink } from 'react-router-dom';

interface NavbarProps {
  text: string;
  text2?: string;
  color1: string;
  color2?: string;
}

export default function Navbar({ text, text2, color1, color2 }: NavbarProps) {
  // State management
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  
  // Material-UI hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  /**
   * Toggles the mobile drawer open/closed state
   */
  const toggleDrawer = (open: boolean): void => {
    setDrawerOpen(open);
  };

  /**
   * Menu items for the mobile drawer (currently empty but ready for future use)
   */
  const menuItems = (
    <>
      {/* Future menu items can be added here */}
    </>
  );

  return (
    <div>
      {/* Primary App Bar */}
      <AppBar position="fixed" style={{ backgroundColor: color1 }}>
        <Toolbar>
          <Typography 
            variant="h6" 
            sx={{ 
              flexGrow: 1, 
              textAlign: 'center', 
              fontSize: '24px', 
              fontWeight: 'bold' 
            }}
          >
            {text}
          </Typography>
        </Toolbar>
      </AppBar>
      
      {/* Secondary App Bar (optional) */}
      {color2 && text2 && (
        <AppBar
          position="fixed"
          style={{ 
            backgroundColor: color2, 
            top: 'auto', 
            marginTop: '-140px' 
          }}
        >
          <Toolbar>
            <Typography 
              variant="h6" 
              sx={{ 
                flexGrow: 1, 
                textAlign: 'center', 
                fontSize: '24px', 
                fontWeight: 'bold', 
                color: 'black' 
              }}
            >
              {text2}
            </Typography>
          </Toolbar>
        </AppBar>
      )}
    </div>
  );
}
