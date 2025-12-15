/**
 * Layered Component System for KRONOS Platform
 * 
 * Provides modern layered UI components with depth, shadows, and visual hierarchy
 */

import React, { CSSProperties, ReactNode } from 'react';
import { motion, Variants } from 'framer-motion';

// Depth levels for layered components
export enum LayerDepth {
  SURFACE = 0,
  ELEVATED_1 = 1,
  ELEVATED_2 = 2,
  ELEVATED_3 = 3,
  ELEVATED_4 = 4,
  FLOATING_1 = 8,
  FLOATING_2 = 16,
  MODAL = 24,
  TOOLTIP = 32,
  NOTIFICATION = 40
}

// Color schemes for different layer types
export interface LayerColorScheme {
  background: string;
  border: string;
  shadow: string;
  text: string;
  accent: string;
  gradient?: {
    from: string;
    to: string;
    direction?: string;
  };
}

// Glass morphism configuration
export interface GlassMorphismConfig {
  opacity: number;
  blur: number;
  saturation: number;
  border: {
    width: number;
    color: string;
    style: string;
  };
  background: {
    color: string;
    opacity: number;
  };
}

// Shadow configuration for different depths
export interface ShadowConfig {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
}

// Base layered component props
export interface LayeredComponentProps {
  children: ReactNode;
  depth?: LayerDepth;
  colorScheme?: LayerColorScheme;
  glassmorphism?: GlassMorphismConfig;
  rounded?: boolean;
  border?: boolean;
  hoverable?: boolean;
  clickable?: boolean;
  animated?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  onHover?: () => void;
  onLeave?: () => void;
}

// Get shadow for specific depth level
export const getShadowForDepth = (depth: LayerDepth): ShadowConfig => {
  const shadows: Record<LayerDepth, ShadowConfig> = {
    [LayerDepth.SURFACE]: { x: 0, y: 0, blur: 0, spread: 0, color: '#000', opacity: 0 },
    [LayerDepth.ELEVATED_1]: { x: 0, y: 1, blur: 3, spread: 0, color: '#000', opacity: 0.12 },
    [LayerDepth.ELEVATED_2]: { x: 0, y: 2, blur: 6, spread: 0, color: '#000', opacity: 0.16 },
    [LayerDepth.ELEVATED_3]: { x: 0, y: 4, blur: 12, spread: -1, color: '#000', opacity: 0.20 },
    [LayerDepth.ELEVATED_4]: { x: 0, y: 8, blur: 24, spread: -2, color: '#000', opacity: 0.24 },
    [LayerDepth.FLOATING_1]: { x: 0, y: 12, blur: 36, spread: -3, color: '#000', opacity: 0.28 },
    [LayerDepth.FLOATING_2]: { x: 0, y: 16, blur: 48, spread: -4, color: '#000', opacity: 0.32 },
    [LayerDepth.MODAL]: { x: 0, y: 24, blur: 64, spread: -8, color: '#000', opacity: 0.40 },
    [LayerDepth.TOOLTIP]: { x: 0, y: 8, blur: 16, spread: 0, color: '#000', opacity: 0.24 },
    [LayerDepth.NOTIFICATION]: { x: 0, y: 12, blur: 32, spread: -2, color: '#000', opacity: 0.36 }
  };
  
  return shadows[depth] || shadows[LayerDepth.ELEVATED_1];
};

// Convert shadow config to CSS string
export const shadowToCSS = (shadow: ShadowConfig): string => {
  if (shadow.opacity === 0) return 'none';
  return `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${shadow.color.replace('#', 'rgba(')}${shadow.opacity})`;
};

// Generate glass morphism CSS
export const glassMorphismCSS = (config: GlassMorphismConfig): CSSProperties => ({
  background: `rgba(${config.background.color}, ${config.background.opacity})`,
  backdropFilter: `blur(${config.blur}px) saturate(${config.saturation}%)`,
  border: `${config.border.width}px ${config.border.style} ${config.border.color}`,
  WebkitBackdropFilter: `blur(${config.blur}px) saturate(${config.saturation}%)`,
});

// Animation variants for layered components
export const layerAnimationVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
      mass: 0.8
    }
  },
  hover: {
    scale: 1.02,
    y: -2,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25
    }
  },
  tap: {
    scale: 0.98,
    y: 1,
    transition: {
      type: "spring",
      stiffness: 600,
      damping: 30
    }
  }
};

// Base layered component
export const LayeredComponent: React.FC<LayeredComponentProps> = ({
  children,
  depth = LayerDepth.SURFACE,
  colorScheme,
  glassmorphism,
  rounded = true,
  border = false,
  hoverable = false,
  clickable = false,
  animated = true,
  className = '',
  style = {},
  onClick,
  onHover,
  onLeave,
  ...props
}) => {
  // Generate base styles
  const baseStyle: CSSProperties = {
    position: 'relative',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    ...style
  };

  // Apply depth and shadows
  const shadow = getShadowForDepth(depth);
  baseStyle.boxShadow = shadowToCSS(shadow);

  // Apply color scheme
  if (colorScheme) {
    baseStyle.backgroundColor = colorScheme.background;
    baseStyle.borderColor = colorScheme.border;
    baseStyle.color = colorScheme.text;
    
    // Apply gradient if specified
    if (colorScheme.gradient) {
      baseStyle.background = `linear-gradient(${colorScheme.gradient.direction || '135deg'}, ${colorScheme.gradient.from}, ${colorScheme.gradient.to})`;
    }
  }

  // Apply glass morphism
  if (glassmorphism) {
    Object.assign(baseStyle, glassMorphismCSS(glassmorphism));
  }

  // Apply rounded corners
  if (rounded) {
    baseStyle.borderRadius = depth > LayerDepth.SURFACE ? '12px' : '8px';
  }

  // Apply border
  if (border) {
    baseStyle.border = '1px solid rgba(255, 255, 255, 0.1)';
  }

  // Apply hover and click effects
  if (hoverable || clickable) {
    baseStyle.cursor = 'pointer';
    baseStyle.transform = 'translateZ(0)'; // Enable hardware acceleration
    baseStyle.willChange = 'transform, box-shadow';
    
    baseStyle[':hover'] = {
      boxShadow: shadowToCSS({
        ...shadow,
        y: shadow.y + 2,
        blur: shadow.blur + 4,
        opacity: Math.min(shadow.opacity + 0.1, 0.5)
      })
    };
  }

  // Apply interactive events
  const handleClick = () => {
    if (clickable && onClick) {
      onClick();
    }
  };

  const handleMouseEnter = () => {
    if (hoverable && onHover) {
      onHover();
    }
  };

  const handleMouseLeave = () => {
    if (hoverable && onLeave) {
      onLeave();
    }
  };

  // Component with animation
  if (animated) {
    return (
      <motion.div
        className={`layered-component ${className}`}
        style={baseStyle}
        variants={layerAnimationVariants}
        initial="hidden"
        animate="visible"
        whileHover={hoverable ? "hover" : undefined}
        whileTap={clickable ? "tap" : undefined}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  // Static component without animation
  return (
    <div
      className={`layered-component ${className}`}
      style={baseStyle}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </div>
  );
};

// Predefined color schemes
export const colorSchemes = {
  light: {
    background: '#ffffff',
    border: 'rgba(0, 0, 0, 0.08)',
    shadow: 'rgba(0, 0, 0, 0.12)',
    text: '#1a1a1a',
    accent: '#0066cc'
  } as LayerColorScheme,

  dark: {
    background: '#1a1a1a',
    border: 'rgba(255, 255, 255, 0.1)',
    shadow: 'rgba(0, 0, 0, 0.5)',
    text: '#ffffff',
    accent: '#4da6ff',
    gradient: {
      from: '#1a1a1a',
      to: '#2d2d2d',
      direction: '135deg'
    }
  } as LayerColorScheme,

  glass: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'rgba(255, 255, 255, 0.2)',
    shadow: 'rgba(0, 0, 0, 0.1)',
    text: '#1a1a1a',
    accent: '#0066cc'
  } as LayerColorScheme,

  accent: {
    background: '#f0f8ff',
    border: 'rgba(0, 102, 204, 0.2)',
    shadow: 'rgba(0, 102, 204, 0.15)',
    text: '#1a1a1a',
    accent: '#0066cc',
    gradient: {
      from: '#f0f8ff',
      to: '#e6f3ff',
      direction: '135deg'
    }
  } as LayerColorScheme
};

// Glass morphism presets
export const glassMorphismPresets = {
  subtle: {
    opacity: 0.8,
    blur: 4,
    saturation: 150,
    border: {
      width: 1,
      color: 'rgba(255, 255, 255, 0.2)',
      style: 'solid'
    },
    background: {
      color: '255, 255, 255',
      opacity: 0.1
    }
  } as GlassMorphismConfig,

  medium: {
    opacity: 0.9,
    blur: 8,
    saturation: 180,
    border: {
      width: 1,
      color: 'rgba(255, 255, 255, 0.3)',
      style: 'solid'
    },
    background: {
      color: '255, 255, 255',
      opacity: 0.2
    }
  } as GlassMorphismConfig,

  strong: {
    opacity: 1,
    blur: 16,
    saturation: 200,
    border: {
      width: 2,
      color: 'rgba(255, 255, 255, 0.4)',
      style: 'solid'
    },
    background: {
      color: '255, 255, 255',
      opacity: 0.3
    }
  } as GlassMorphismConfig
};

// Utility function to combine styles
export const combineStyles = (...styles: (CSSProperties | undefined)[]): CSSProperties => {
  return styles.reduce((combined, style) => {
    if (style) {
      Object.assign(combined, style);
    }
    return combined;
  }, {});
};

export default LayeredComponent;
