/**
 * Layered Card Component for KRONOS Platform
 * 
 * Modern card component with layered design, glass morphism, and animations
 */

import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import LayeredComponent, { LayerDepth, colorSchemes, glassMorphismPresets } from './LayeredComponent';

export interface LayeredCardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  variant?: 'default' | 'elevated' | 'glass' | 'gradient';
  size?: 'small' | 'medium' | 'large';
  hoverable?: boolean;
  clickable?: boolean;
  depth?: LayerDepth;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

// Card size configurations
const cardSizes = {
  small: {
    padding: '16px',
    titleSize: '16px',
    subtitleSize: '14px',
    spacing: '12px'
  },
  medium: {
    padding: '24px',
    titleSize: '18px',
    subtitleSize: '16px',
    spacing: '16px'
  },
  large: {
    padding: '32px',
    titleSize: '20px',
    subtitleSize: '18px',
    spacing: '20px'
  }
};

// Get card variant styles
const getCardVariantStyles = (variant: string) => {
  switch (variant) {
    case 'elevated':
      return {
        colorScheme: colorSchemes.light,
        depth: LayerDepth.ELEVATED_2,
        glassmorphism: undefined
      };
    case 'glass':
      return {
        colorScheme: colorSchemes.glass,
        depth: LayerDepth.FLOATING_1,
        glassmorphism: glassMorphismPresets.medium
      };
    case 'gradient':
      return {
        colorScheme: colorSchemes.accent,
        depth: LayerDepth.ELEVATED_1,
        glassmorphism: undefined
      };
    default:
      return {
        colorScheme: colorSchemes.light,
        depth: LayerDepth.ELEVATED_1,
        glassmorphism: undefined
      };
  }
};

// Animation variants for cards
const cardVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25,
      delay: 0.1
    }
  },
  hover: {
    y: -4,
    scale: 1.02,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25
    }
  }
};

export const LayeredCard: React.FC<LayeredCardProps> = ({
  children,
  title,
  subtitle,
  icon,
  actions,
  variant = 'default',
  size = 'medium',
  hoverable = false,
  clickable = false,
  depth,
  onClick,
  className = '',
  style = {},
  ...props
}) => {
  const sizeConfig = cardSizes[size];
  const variantStyles = getCardVariantStyles(variant);
  
  const cardStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 'auto',
    padding: sizeConfig.padding,
    ...style
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sizeConfig.spacing,
    paddingBottom: sizeConfig.spacing,
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: sizeConfig.titleSize,
    fontWeight: 600,
    lineHeight: 1.2,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: sizeConfig.subtitleSize,
    color: 'rgba(0, 0, 0, 0.6)',
    margin: '4px 0 0 0',
    lineHeight: 1.4
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const contentStyle: React.CSSProperties = {
    flex: 1
  };

  const cardContent = (
    <>
      {/* Header */}
      {(title || subtitle || icon || actions) && (
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
            {/* Icon */}
            {icon && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(0, 102, 204, 0.1)',
                color: '#0066cc',
                flexShrink: 0
              }}>
                {icon}
              </div>
            )}
            
            {/* Title and Subtitle */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {title && <h3 style={titleStyle}>{title}</h3>}
              {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
            </div>
          </div>
          
          {/* Actions */}
          {actions && (
            <div style={actionsStyle}>
              {actions}
            </div>
          )}
        </div>
      )}
      
      {/* Content */}
      <div style={contentStyle}>
        {children}
      </div>
    </>
  );

  return (
    <motion.div
      className={`layered-card ${className}`}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={hoverable ? "hover" : undefined}
      style={cardStyle}
      onClick={clickable ? onClick : undefined}
      {...props}
    >
      <LayeredComponent
        depth={depth || variantStyles.depth}
        colorScheme={variantStyles.colorScheme}
        glassmorphism={variantStyles.glassmorphism}
        hoverable={hoverable}
        clickable={clickable}
        rounded={true}
        border={variant === 'glass'}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {cardContent}
      </LayeredComponent>
    </motion.div>
  );
};

// Specialized card variants
export const StatCard: React.FC<{
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: 'up' | 'down' | 'neutral';
  };
  icon?: ReactNode;
  color?: 'primary' | 'success' | 'warning' | 'error';
  size?: 'small' | 'medium' | 'large';
}> = ({ title, value, change, icon, color = 'primary', size = 'medium' }) => {
  const colorConfig = {
    primary: { bg: 'rgba(0, 102, 204, 0.1)', text: '#0066cc', icon: '#0066cc' },
    success: { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e', icon: '#22c55e' },
    warning: { bg: 'rgba(251, 191, 36, 0.1)', text: '#fbbf24', icon: '#fbbf24' },
    error: { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444', icon: '#ef4444' }
  }[color];

  const sizeConfig = cardSizes[size];
  
  const valueStyle: React.CSSProperties = {
    fontSize: size === 'small' ? '24px' : size === 'medium' ? '32px' : '40px',
    fontWeight: 700,
    color: colorConfig.text,
    lineHeight: 1,
    margin: '8px 0'
  };

  const changeStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  };

  const trendIcon = change ? (
    <span style={{
      color: change.trend === 'up' ? '#22c55e' : change.trend === 'down' ? '#ef4444' : '#6b7280'
    }}>
      {change.trend === 'up' ? '↗' : change.trend === 'down' ? '↘' : '→'}
    </span>
  ) : null;

  return (
    <LayeredCard
      size={size}
      variant="elevated"
      hoverable={true}
      style={{ 
        background: colorConfig.bg,
        border: `1px solid ${colorConfig.text}20`
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: sizeConfig.subtitleSize, 
            color: 'rgba(0, 0, 0, 0.6)',
            fontWeight: 500 
          }}>
            {title}
          </div>
          <div style={valueStyle}>
            {value}
          </div>
          {change && (
            <div style={changeStyle}>
              {trendIcon}
              <span>{Math.abs(change.value)}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: colorConfig.bg,
            color: colorConfig.icon,
            fontSize: '20px'
          }}>
            {icon}
          </div>
        )}
      </div>
    </LayeredCard>
  );
};

export const ActionCard: React.FC<{
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
}> = ({ title, description, icon, onClick, variant = 'primary', size = 'medium' }) => {
  const variantConfig = {
    primary: {
      background: 'linear-gradient(135deg, #0066cc, #4da6ff)',
      text: '#ffffff'
    },
    secondary: {
      background: 'linear-gradient(135deg, #6b7280, #9ca3af)',
      text: '#ffffff'
    },
    outline: {
      background: 'transparent',
      text: '#0066cc',
      border: '2px solid #0066cc'
    }
  }[variant];

  return (
    <LayeredCard
      size={size}
      variant="elevated"
      clickable={true}
      onClick={onClick}
      style={{
        background: variantConfig.background,
        color: variantConfig.text,
        border: variantConfig.border,
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      className="action-card"
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '16px',
        textAlign: 'left',
        width: '100%'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: variant === 'outline' ? 'rgba(0, 102, 204, 0.1)' : 'rgba(255, 255, 255, 0.2)',
          color: variantConfig.text,
          fontSize: '20px',
          flexShrink: 0
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{ 
            margin: '0 0 4px 0', 
            fontSize: '16px', 
            fontWeight: 600,
            color: variantConfig.text
          }}>
            {title}
          </h4>
          <p style={{ 
            margin: 0, 
            fontSize: '14px', 
            opacity: 0.8,
            color: variantConfig.text
          }}>
            {description}
          </p>
        </div>
      </div>
    </LayeredCard>
  );
};

export default LayeredCard;
