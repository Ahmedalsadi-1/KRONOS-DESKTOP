console.log('Setting up AI services...');

// Check if required dependencies are installed
const checkDependencies = () => {
  const required = ['puppeteer', 'tesseract.js', 'express', 'socket.io'];
  const missing = [];

  required.forEach(dep => {
    try {
      require.resolve(dep);
    } catch {
      missing.push(dep);
    }
  });

  if (missing.length > 0) {
    console.warn('Missing dependencies:', missing.join(', '));
    console.log('Run: npm install', missing.join(' '));
  } else {
    console.log('✅ All AI service dependencies are installed');
  }
};

checkDependencies();
console.log('AI services setup complete');