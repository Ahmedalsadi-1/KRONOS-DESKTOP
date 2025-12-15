import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import axios from 'axios';
import '../styles/wizard.css';

const WizardContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
`;

const WizardHeader = styled.div`
  text-align: center;
  padding: 3rem 2rem;
`;

const Logo = styled(motion.div)`
  width: 120px;
  height: 120px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  font-weight: 300;
  letter-spacing: 2px;
  color: #ffffff;
  animation: pulse 2s infinite;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 300;
  margin-bottom: 1rem;
  color: #ffffff;
`;

const Subtitle = styled.p`
  font-size: 1.25rem;
  opacity: 0.8;
  margin-bottom: 3rem;
`;

const Form = styled.form`
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 2rem;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const FormGroup = styled.div`
  margin-bottom: 2rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  font-size: 1rem;
  color: #ffffff;
`;

const Input = styled.input`
  width: 100%;
  padding: 1rem;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  color: #ffffff;
  font-size: 1rem;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.6);
  }
  
  &:focus {
    outline: 2px solid #667eea;
    background: rgba(255, 255, 255, 0.95);
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 1rem 2rem;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 2rem;
`;

const ProgressFill = styled(motion.div)`
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #52c41a 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
`;

const ErrorMessage = styled.div`
  background: rgba(244, 67, 54, 0.9);
  color: #ffffff;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.875rem;
`;

function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState({
    installationPath: '',
    autoStart: true,
    startMinimized: false,
    theme: 'dark',
    enableTelemetry: true
  });
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  const validateAndProceed = async (step) => {
    setIsValidating(true);
    setError('');
    
    try {
      // Validate current step
      switch (step) {
        case 0:
          if (!config.installationPath.trim()) {
            throw new Error('Please specify an installation path');
          }
          break;
        case 1:
          // Services validation
          break;
        case 2:
          // Theme selection validation
          break;
        case 3:
          // Final validation
          if (!config.enableTelemetry) {
            throw new Error('Please accept the telemetry policy to continue');
          }
          break;
      }
      
      setCurrentStep(step + 1);
    } catch (err) {
      setError(err.message);
      setIsValidating(false);
    } finally {
      setIsValidating(false);
    }
  };

  const saveConfiguration = async () => {
    try {
      // Save configuration to main process
      await window.kronosConfig.setConfig(config);
      
      // Close wizard and launch main app
      window.kronosConfig.closeWizard();
      
      console.log('Configuration saved successfully:', config);
    } catch (error) {
      setError('Failed to save configuration: ' + error.message);
    }
  };

  const totalSteps = 4;

  return (
    <WizardContainer>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <WizardHeader>
          <Logo
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: 360 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          >
            KRONOS
          </Logo>
          <Title>Setup Wizard</Title>
          <Subtitle>Professional Automation Platform Configuration</Subtitle>
        </WizardHeader>

        <Form>
          {/* Step 1: Installation Path */}
          {currentStep === 0 && (
            <FormGroup>
              <Label>Installation Path</Label>
              <Input
                type="text"
                value={config.installationPath}
                onChange={(e) => setConfig({
                  ...config,
                  installationPath: e.target.value
                })}
                placeholder="/Applications/KRONOS Desktop Agent"
                disabled={isValidating}
              />
            </FormGroup>
          )}

          {/* Step 2: Services Selection */}
          {currentStep === 1 && (
            <FormGroup>
              <Label>Services to Enable</Label>
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={config.autoStart}
                    onChange={(e) => setConfig({
                      ...config,
                      autoStart: e.target.checked
                    })}
                    disabled={isValidating}
                  />
                  <span>Auto-start with system</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                  />
                  <span>AI Services</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                  />
                  <span>Web Automation</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                  />
                  <span>Computer Vision</span>
                </label>
              </div>
            </FormGroup>
          )}

          {/* Step 3: Theme Selection */}
          {currentStep === 2 && (
            <FormGroup>
              <Label>Choose Theme</Label>
              <div>
                <label>
                  <input
                    type="radio"
                    name="theme"
                    value="dark"
                    checked={config.theme === 'dark'}
                    onChange={(e) => setConfig({
                      ...config,
                      theme: 'dark'
                    })}
                    disabled={isValidating}
                  />
                  <span>🌙 Dark Mode</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="theme"
                    value="light"
                    checked={config.theme === 'light'}
                    onChange={(e) => setConfig({
                      ...config,
                      theme: 'light'
                    })}
                    disabled={isValidating}
                  />
                  <span>☀️ Light Mode</span>
                </label>
              </div>
            </FormGroup>
          )}

          {/* Step 4: Privacy & Telemetry */}
          {currentStep === 3 && (
            <FormGroup>
              <Label>Privacy & Telemetry</Label>
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={config.enableTelemetry}
                    onChange={(e) => setConfig({
                      ...config,
                      enableTelemetry: e.target.checked
                    })}
                    disabled={isValidating}
                  />
                  <span>Enable anonymous usage data collection to improve product experience</span>
                </label>
                <p style={{ fontSize: '0.875rem', opacity: 0.7, marginTop: '0.5rem' }}>
                  We collect anonymous usage statistics to help improve KRONOS. This data is never personally identifiable and helps us understand how the application is used.
                </p>
              </div>
            </FormGroup>
          )}
        </Form>

        {error && (
          <ErrorMessage>
            ⚠️ {error}
          </ErrorMessage>
        )}

        {/* Progress Bar */}
        <ProgressBar>
          <ProgressFill
            initial={{ width: 0 }}
            animate={{ width: (currentStep + 1) / totalSteps }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          />
        </ProgressBar>

        {/* Navigation Buttons */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: '2rem' 
        }}>
          {currentStep > 0 && (
            <Button
              type="button"
              onClick={() => setCurrentStep(currentStep - 1)}
              disabled={isValidating}
              style={{ background: 'rgba(255, 255, 255, 0.1)' }}
            >
              ← Back
            </Button>
          )}
          
          {currentStep < totalSteps - 1 && (
            <Button
              type="button"
              onClick={() => validateAndProceed(currentStep)}
              disabled={isValidating || !config.installationPath.trim()}
              whileHover={{ scale: 1.02 }}
            >
              {currentStep === totalSteps - 1 ? 'Start KRONOS' : 'Next →'}
            </Button>
          )}
        </div>
      </motion.div>
    </WizardContainer>
  );
}

export default SetupWizard;