/**
 * Layered Button Component for KRONOS Platform
 * 
 * Modern button component with layered design, animations, and multiple variants
 */

import React, { ReactNode, forwardRef } from 'react';
import { motion, MotionProps } from 'framer-motion';
import LayeredComponent, { LayerDepth, colorSchemes } from './LayeredComponent';

export interface LayeredButtonProps extends Omit<MotionProps, 'children'> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'glass';
  size?: 'small' | 'medium' | 'large';
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  depth?: LayerDepth;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  style?: React.CSSProperties;
}

// Button size configurations
const buttonSizes = {
  small: {
    padding: '8px 16px',
    fontSize: '14px',
    height: '32px',
    iconSize: '16px',
    gap: '6px',
    borderRadius: '6px'
  },
  medium: {
    padding: '12px 24px',
    fontSize: '16px',
    height: '40px',
    iconSize: '18px',
    gap: '8px',
    borderRadius: '8px'
  },
  large: {
    padding: '16px 32px',
    fontSize: '18px',
    height: '48px',
    iconSize: '20px',
    gap: '10px',
    borderRadius: '10px'
  }
};

// Button variant styles
const getButtonVariantStyles = (variant: string) => {
  const styles = {
    primary: {
      background: 'linear-gradient(135deg, #0066cc, #4da6ff)',
      color: '#ffffff',
      border: 'none',
      boxShadow: '0 2px 4px rgba(0, 102, 204, 0.3)',
      hoverBackground: 'linear-gradient(135deg, #0052a3, #3399ff)',
      activeBackground: 'linear-gradient(135deg, #003d7a, #1a8fff)',
      depth: LayerDepth.ELEVATED_1
    },
    secondary: {
      background: 'linear-gradient(135deg, #6b7280, #9ca3af)',
      color: '#ffffff',
      border: 'none',
      boxShadow: '0 2px 4px rgba(107, 114, 128, 0.3)',
      hoverBackground: 'linear-gradient(135deg, #5a6270, #8b95a1)',
      activeBackground: 'linear-gradient(135deg, #4a5060, #7b8591)',
      depth: LayerDepth.ELEVATED_1
    },
    outline: {
      background: 'transparent',
      color: '#0066cc',
      border: '2px solid #0066cc',
      boxShadow: 'none',
      hoverBackground: 'rgba(0, 102, 204, 0.1)',
      activeBackground: 'rgba(0, 102, 204, 0.2)',
      depth: LayerDepth.SURFACE
    },
    ghost: {
      background: 'transparent',
      color: '#6b7280',
      border: 'none',
      boxShadow: 'none',
      hoverBackground: 'rgba(107, 114, 128, 0.1)',
      activeBackground: 'rgba(107, 114, 128, 0.2)',
      depth: LayerDepth.SURFACE
    },
    danger: {
      background: 'linear-gradient(135deg, #ef4444, #f87171)',
      color: '#ffffff',
      border: 'none',
      boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)',
      hoverBackground: 'linear-gradient(135deg, #dc2626, #ef4444)',
      activeBackground: 'linear-gradient(135deg, #b91c1c, #dc2626)',
      depth: LayerDepth.ELEVATED_1
    },
    success: {
      background: 'linear-gradient(135deg, #22c55e, #4ade80)',
      color: '#ffffff',
      border: 'none',
      boxShadow: '0 2px 4px rgba(34, 197, 94, 0.3)',
      hoverBackground: 'linear-gradient(135deg, #16a34a, #22c55e)',
      activeBackground: 'linear-gradient(135deg, #15803d, #16a34a)',
      depth: LayerDepth.ELEVATED_1
    },
    glass: {
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#1a1a1a',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      hoverBackground: 'rgba(255, 255, 255, 0.2)',
      activeBackground: 'rgba(255, 255, 255, 0.3)',
      depth: LayerDepth.FLOATING_1
    }
  };

  return styles[variant as keyof typeof styles] || styles.primary;
};

// Button animation variants
const buttonVariants = {
  idle: {
    scale: 1,
    y: 0
  },
  hover: {
    scale: 1.02,
    y: -1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25
    }
  },
  tap: {
    scale: 0.98,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 600,
      damping: 30
    }
  },
  loading: {
    scale: 1,
    y: 0
  }
};

// Loading spinner component
const LoadingSpinner: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <motion.div
    style={{
      width: size,
      height: size,
      border: `2px solid ${color}`,
      borderTop: '2px solid transparent',
      borderRadius: '50%'
    }}
    animate={{ rotate: 360 }}
    transition={{
      duration: 1,
      repeat: Infinity,
      ease: "linear"
    }}
  />
);

export const LayeredButton = forwardRef<HTMLButtonElement, LayeredButtonProps>(({
  children,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  depth,
  onClick,
  type = 'button',
  className = '',
  style = {},
  ...props
}, ref) => {
  const sizeConfig = buttonSizes[size];
  const variantStyles = getButtonVariantStyles(variant);

  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sizeConfig.gap,
    padding: sizeConfig.padding,
    fontSize: sizeConfig.fontSize,
    fontWeight: 600,
    lineHeight: 1,
    height: sizeConfig.height,
    borderRadius: sizeConfig.borderRadius,
    border: variantStyles.border,
    background: disabled ? '#e5e7eb' : loading ? variantStyles.activeBackground : variantStyles.background,
    color: disabled ? '#9ca3af' : variantStyles.color,
    boxShadow: disabled ? 'none' : variantStyles.boxShadow,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    width: fullWidth ? '100%' : 'auto',
    minWidth: fullWidth ? 'auto' : 'auto',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    outline: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    ...style
  };

  const iconStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: sizeConfig.iconSize,
    flexShrink: 0
  };

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: sizeConfig.gap,
    whiteSpace: 'nowrap'
  };

  const handleClick = () => {
    if (!disabled && !loading && onClick) {
      onClick();
    }
  };

  const buttonContent = (
    <div style={contentStyle}>
      {/* Left icon */}
      {icon && iconPosition === 'left' && (
        <div style={iconStyle}>
          {loading ? <LoadingSpinner size={sizeConfig.iconSize} color={variantStyles.color} /> : icon}
        </div>
      )}
      
      {/* Text content */}
      {children && (
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {children}
        </span>
      )}
      
      {/* Right icon */}
      {icon && iconPosition === 'right' && (
        <div style={iconStyle}>
          {loading ? <LoadingSpinner size={sizeConfig.iconSize} color={variantStyles.color} /> : icon}
        </div>
      )}
    </div>
  );

  // Use motion component for interactive variants
  if (variant === 'glass') {
    return (
      <motion.button
        ref={ref}
        type={type}
        className={`layered-button ${className}`}
        variants={buttonVariants}
        initial="idle"
        whileHover={!disabled && !loading ? "hover" : undefined}
        whileTap={!disabled && !loading ? "tap" : undefined}
        animate={loading ? "loading" : "idle"}
        style={buttonStyle}
        onClick={handleClick}
        disabled={disabled || loading}
        {...props}
      >
        <LayeredComponent
          depth={depth || variantStyles.depth}
          colorScheme={colorSchemes.glass}
          glassmorphism={{
            opacity: 0.9,
            blur: 8,
            saturation: 180,
            border: {
              width: 1,
              color: 'rgba(255, 255, 255, 0.2)',
              style: 'solid'
            },
            background: {
              color: '255, 255, 255',
              opacity: 0.1
            }
          }}
          rounded={true}
          border={true}
          hoverable={!disabled && !loading}
          clickable={!disabled && !loading}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {buttonContent}
        </LayeredComponent>
      </motion.button>
    );
  }

  // Standard button with motion
  return (
    <motion.button
      ref={ref}
      type={type}
      className={`layered-button ${className}`}
      variants={buttonVariants}
      initial="idle"
      whileHover={!disabled && !loading ? "hover" : undefined}
      whileTap={!disabled && !loading ? "tap" : undefined}
      animate={loading ? "loading" : "idle"}
      style={buttonStyle}
      onClick={handleClick}
      disabled={disabled || loading}
      {...props}
    >
      {buttonContent}
    </motion.button>
  );
});

LayeredButton.displayName = 'LayeredButton';

// Specialized button variants
export const IconButton: React.FC<{
  icon: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'glass';
  size?: 'small' | 'medium' | 'large';
  tooltip?: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}> = ({ icon, variant = 'primary', size = 'medium', tooltip, onClick, disabled = false, className = '' }) => {
  const sizeConfig = buttonSizes[size];
  const variantStyles = getButtonVariantStyles(variant);

  const iconButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size === 'small' ? '32px' : size === 'medium' ? '40px' : '48px',
    height: size === 'small' ? '32px' : size === 'medium' ? '40px' : '48px',
    padding: '0',
    borderRadius: size === 'small' ? '6px' : size === 'medium' ? '8px' : '10px',
    border: variantStyles.border,
    background: disabled ? '#e5e7eb' : variantStyles.background,
    color: disabled ? '#9ca3af' : variantStyles.color,
    boxShadow: disabled ? 'none' : variantStyles.boxShadow,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    outline: 'none'
  };

  const iconStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: sizeConfig.iconSize
  };

  return (
    <motion.button
      className={`layered-icon-button ${className}`}
      variants={buttonVariants}
      initial="idle"
      whileHover={!disabled ? "hover" : undefined}
      whileTap={!disabled ? "tap" : undefined}
      style={iconButtonStyle}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
    >
      <div style={iconStyle}>
        {icon}
      </div>
    </motion.button>
  );
};

export const ToggleButton: React.FC<{
  active: boolean;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  icon?: ReactNode;
  activeIcon?: ReactNode;
  children?: ReactNode;
  className?: string;
}> = ({ active, onClick, variant = 'primary', size = 'medium', icon, activeIcon, children, className = '' }) => {
  const isActive = active;
  const currentVariant = isActive ? variant : 'ghost';

  return (
    <LayeredButton
      variant={currentVariant}
      size={size}
      icon={isActive ? activeIcon : icon}
      onClick={onClick}
      className={`layered-toggle-button ${className}`}
    >
      {children}
    </LayeredButton>
  );
};

export const ButtonGroup: React.FC<{
  children: ReactNode;
  variant?: 'horizontal' | 'vertical';
  size?: 'small' | 'medium' | 'large';
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, variant = 'horizontal', size = 'medium', className = '', style = {} }) => {
  const groupStyle: React.CSSProperties = {
    display: 'inline-flex',
    flexDirection: variant === 'horizontal' ? 'row' : 'column',
    gap: '0',
    ...style
  };

  return (
    <div className={`layered-button-group ${className}`} style={groupStyle}>
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {
          const isFirst = index === 0;
          const isLast = index === React.Children.count(children) - 1;
          
          const borderRadius = variant === 'horizontal' 
            ? isFirst ? `${buttonSizes[size].borderRadius} 0 0 ${buttonSizes[size].borderRadius}`
              : isLast ? `0 ${buttonSizes[size].borderRadius} ${buttonSizes[size].borderRadius} 0`
              : '0 0 0 0'
            : isFirst ? `${buttonSizes[size].borderRadius} ${buttonSizes[size].borderRadius} 0 0`
              : isLast ? `0 0 ${buttonSizes[size].borderRadius} ${buttonSizes[size].borderRadius}`
              : '0 0 0 0';
          
          const margin = variant === 'horizontal' 
            ? isFirst || isLast ? '0' : '0 -1px 0 0'
            : isFirst || isLast ? '0' : '-1px 0 0 0';
          
          return React.cloneElement(child as React.ReactElement<any>, {
            style: {
              ...child.props.style,
              borderRadius,
              margin,
              borderRight: variant === 'horizontal' && !isLast ? 'none' : undefined,
              borderBottom: variant === 'vertical' && !isLast ? 'none' : undefined
            }
          });
        }
        return child;
      })}
    </div>
  );
};

export default LayeredButton;
