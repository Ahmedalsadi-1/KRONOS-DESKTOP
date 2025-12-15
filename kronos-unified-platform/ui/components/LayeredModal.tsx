/**
 * Layered Modal Component for KRONOS Platform
 * 
 * Modern modal/dialog component with layered design, animations, and multiple variants
 */

import React, { ReactNode, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LayeredComponent, { LayerDepth, colorSchemes } from './LayeredComponent';
import { LayeredButton } from './LayeredButton';

export interface LayeredModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  variant?: 'default' | 'glass' | 'gradient' | 'danger' | 'warning' | 'info';
  closable?: boolean;
  maskClosable?: boolean;
  keyboard?: boolean;
  centered?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

// Modal size configurations
const modalSizes = {
  small: {
    maxWidth: '400px',
    width: '90%',
    minHeight: '200px'
  },
  medium: {
    maxWidth: '600px',
    width: '90%',
    minHeight: '300px'
  },
  large: {
    maxWidth: '900px',
    width: '90%',
    minHeight: '400px'
  },
  fullscreen: {
    maxWidth: '95vw',
    width: '95%',
    height: '90vh',
    minHeight: '500px'
  }
};

// Modal variant styles
const getModalVariantStyles = (variant: string) => {
  const styles = {
    default: {
      background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
      color: '#1a1a1a',
      border: '1px solid rgba(0, 0, 0, 0.1)',
      shadowColor: 'rgba(0, 0, 0, 0.2)',
      depth: LayerDepth.FLOATING_3
    },
    glass: {
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#1a1a1a',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      shadowColor: 'rgba(0, 0, 0, 0.3)',
      depth: LayerDepth.FLOATING_4
    },
    gradient: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      shadowColor: 'rgba(102, 126, 234, 0.4)',
      depth: LayerDepth.FLOATING_3
    },
    danger: {
      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      shadowColor: 'rgba(239, 68, 68, 0.4)',
      depth: LayerDepth.FLOATING_3
    },
    warning: {
      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      shadowColor: 'rgba(245, 158, 11, 0.4)',
      depth: LayerDepth.FLOATING_3
    },
    info: {
      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      shadowColor: 'rgba(59, 130, 246, 0.4)',
      depth: LayerDepth.FLOATING_3
    }
  };

  return styles[variant as keyof typeof styles] || styles.default;
};

// Modal animation variants
const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 50
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30
    }
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 50,
    transition: {
      duration: 0.2
    }
  }
};

const overlayVariants = {
  hidden: {
    opacity: 0
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2
    }
  }
};

export const LayeredModal: React.FC<LayeredModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'medium',
  variant = 'default',
  closable = true,
  maskClosable = true,
  keyboard = true,
  centered = false,
  className = '',
  style = {},
  ...props
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  const sizeConfig = modalSizes[size];
  const variantStyles = getModalVariantStyles(variant);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (keyboard && event.key === 'Escape' && open) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, keyboard, onClose]);

  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: centered ? '50%' : '10%',
    left: centered ? '50%' : '50%',
    transform: centered ? 'translate(-50%, -50%)' : 'translate(-50%, 0)',
    maxWidth: sizeConfig.maxWidth,
    width: sizeConfig.width,
    minHeight: sizeConfig.minHeight,
    zIndex: 1000,
    ...style
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: 999,
    display: 'flex',
    alignItems: centered ? 'center' : 'flex-start',
    justifyContent: 'center',
    padding: centered ? '20px' : '40px 20px'
  };

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (maskClosable && event.target === event.currentTarget) {
      onClose();
    }
  };

  const renderContent = () => (
    <div
      ref={modalRef}
      className={`layered-modal-content ${className}`}
      style={modalStyle}
      onClick={(e) => e.stopPropagation()}
    >
      <LayeredComponent
        depth={variantStyles.depth}
        colorScheme={variant === 'glass' ? colorSchemes.glass : colorSchemes.light}
        glassmorphism={variant === 'glass' ? {
          opacity: 0.95,
          blur: 12,
          saturation: 160,
          border: {
            width: 1,
            color: 'rgba(255, 255, 255, 0.2)',
            style: 'solid'
          },
          background: {
            color: '255, 255, 255',
            opacity: 0.1
          }
        } : undefined}
        rounded={true}
        border={true}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: variantStyles.background,
          color: variantStyles.color,
          border: variantStyles.border,
          boxShadow: `0 20px 40px ${variantStyles.shadowColor}`,
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        {(title || closable) && (
          <div
            style={{
              padding: '24px 24px 0 24px',
              borderBottom: variant === 'default' ? '1px solid rgba(0, 0, 0, 0.1)' : 'none',
              marginBottom: children ? '20px' : '0'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              {title && (
                <h2
                  style={{
                    margin: 0,
                    fontSize: '20px',
                    fontWeight: 600,
                    color: variantStyles.color
                  }}
                >
                  {title}
                </h2>
              )}
              {closable && (
                <LayeredButton
                  variant="ghost"
                  size="small"
                  onClick={onClose}
                  style={{
                    padding: '4px',
                    minWidth: 'auto',
                    color: variantStyles.color
                  }}
                >
                  ✕
                </LayeredButton>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        {children && (
          <div
            style={{
              flex: 1,
              padding: '0 24px',
              overflow: 'auto'
            }}
          >
            {children}
          </div>
        )}

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: '20px 24px 24px 24px',
              borderTop: variant === 'default' ? '1px solid rgba(0, 0, 0, 0.1)' : 'none',
              marginTop: '20px'
            }}
          >
            {footer}
          </div>
        )}
      </LayeredComponent>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          style={overlayStyle}
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={handleOverlayClick}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {renderContent()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info'
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <LayeredModal
      open={open}
      onClose={onClose}
      title={title}
      variant={variant}
      size="small"
      footer={
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}
        >
          <LayeredButton
            variant="ghost"
            onClick={onClose}
          >
            {cancelText}
          </LayeredButton>
          <LayeredButton
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
          >
            {confirmText}
          </LayeredButton>
        </div>
      }
    >
      <p style={{ margin: 0, lineHeight: '1.6' }}>{message}</p>
    </LayeredModal>
  );
};

export default LayeredModal;
