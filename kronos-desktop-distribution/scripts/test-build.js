const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class DistributionTester {
  constructor() {
    this.testResults = [];
    this.platform = process.platform;
  }

  async runAllTests() {
    console.log('🧪 Running KRONOS distribution tests...\n');
    
    const tests = [
      this.testBuildProcess,
      this.testDependencies,
      this.testPackageJson,
      this.testElectronConfiguration,
      this.testBuildOutput,
      this.testInstallerCreation,
      this.testCodeSigning
    ];

    for (const test of tests) {
      try {
        await test();
        console.log(`✅ ${test.name} passed`);
      } catch (error) {
        console.error(`❌ ${test.name} failed:`, error.message);
        this.testResults.push({ test: test.name, status: 'failed', error: error.message });
      }
    }

    this.printResults();
  }

  testBuildProcess() {
    return new Promise((resolve, reject) => {
      const test = {
        name: 'Build Process Test',
        run: () => {
          return new Promise((resolve) => {
            console.log('Testing build process...');
            
            // Test if we can access the main files
            const mainFile = path.join(__dirname, '../src/main/index.js');
            const preloadFile = path.join(__dirname, '../src/preload/index.js');
            
            if (fs.existsSync(mainFile) && fs.existsSync(preloadFile)) {
              console.log('✅ Main process files exist');
              resolve(true);
            } else {
              reject(new Error('Main process files missing'));
            }
          });
        }
      };

      setTimeout(() => resolve(test.run()), 1000);
    });
  }

  testDependencies() {
    return new Promise((resolve, reject) => {
      const test = {
        name: 'Dependencies Test',
        run: () => {
          return new Promise((resolve) => {
            exec('npm list --depth=0', (error, stdout, stderr) => {
              if (error) {
                reject(new Error(`Dependencies check failed: ${error.message}`));
                return;
              }
              
              const deps = stdout.trim().split('\n');
              const requiredDeps = ['electron', 'electron-builder', 'electron-updater'];
              
              const missingDeps = requiredDeps.filter(dep => 
                !deps.some(installed => installed.includes(dep))
              );
              
              if (missingDeps.length > 0) {
                console.log(`❌ Missing dependencies: ${missingDeps.join(', ')}`);
                reject(new Error(`Missing dependencies: ${missingDeps.join(', ')}`));
                return;
              }
              
              console.log('✅ All dependencies installed');
              resolve(true);
            });
          });
        }
      };

      setTimeout(() => resolve(test.run()), 1000);
    });
  }

  testPackageJson() {
    return new Promise((resolve, reject) => {
      const test = {
        name: 'Package.json Test',
        run: () => {
          return new Promise((resolve) => {
            const packagePath = path.join(__dirname, '../package.json');
            
            if (!fs.existsSync(packagePath)) {
              reject(new Error('package.json not found'));
              return;
            }
            
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            // Validate required fields
            const requiredFields = ['name', 'version', 'main', 'build', 'scripts'];
            const missingFields = requiredFields.filter(field => !packageJson[field]);
            
            if (missingFields.length > 0) {
              console.log(`❌ Missing package.json fields: ${missingFields.join(', ')}`);
              reject(new Error(`Missing package.json fields: ${missingFields.join(', ')}`));
              return;
            }
            
            // Validate build configuration
            if (!packageJson.build) {
              reject(new Error('build configuration missing from package.json'));
              return;
            }
            
            if (!packageJson.build.appId) {
              reject(new Error('build.appId missing from package.json'));
              return;
            }
            
            console.log('✅ package.json is valid');
            resolve(true);
          });
        }
      };

      setTimeout(() => resolve(test.run()), 1000);
    });
  }

  testElectronConfiguration() {
    return new Promise((resolve, reject) => {
      const test = {
        name: 'Electron Configuration Test',
        run: () => {
          return new Promise((resolve) => {
            const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
            
            // Test build targets
            const platforms = ['mac', 'win', 'linux'];
            const architectures = ['x64', 'arm64', 'ia32'];
            
            for (const platform of platforms) {
              if (packageJson.build[platform]) {
                const platformConfig = packageJson.build[platform];
                
                if (platformConfig.target && Array.isArray(platformConfig.target)) {
                  for (const target of platformConfig.target) {
                    if (!target.target || !target.arch || !Array.isArray(target.arch)) {
                      reject(new Error(`Invalid ${platform} build target configuration for ${target.target}`));
                      return;
                    }
                  }
                }
                
                console.log(`✅ ${platform} configuration valid`);
              } else {
                console.log(`⚠️  ${platform} configuration missing`);
              }
            }
            
            resolve(true);
          });
        }
      };

      setTimeout(() => resolve(test.run()), 1000);
    });
  }

  testBuildOutput() {
    return new Promise((resolve, reject) => {
      const test = {
        name: 'Build Output Test',
        run: () => {
          return new Promise((resolve) => {
            const distDir = path.join(__dirname, '../dist');
            
            if (!fs.existsSync(distDir)) {
              console.log('📁 Creating dist directory for testing...');
              fs.mkdirSync(distDir, { recursive: true });
            }
            
            // Test if we can write to dist directory
            const testFile = path.join(distDir, 'build-test.txt');
            fs.writeFileSync(testFile, `Build test at ${new Date().toISOString()}`);
            
            if (fs.existsSync(testFile)) {
              console.log('✅ Dist directory is writable');
              fs.unlinkSync(testFile);
              resolve(true);
            } else {
              reject(new Error('Dist directory not writable'));
            }
          });
        }
      };

      setTimeout(() => resolve(test.run()), 1000);
    });
  }

  testInstallerCreation() {
    return new Promise((resolve, reject) => {
      const test = {
        name: 'Installer Creation Test',
        run: () => {
          return new Promise((resolve) => {
            const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
            
            // Test NSIS configuration for Windows
            if (packageJson.build.nsis) {
              const nsisConfig = packageJson.build.nsis;
              
              if (nsisConfig.oneClick === false && nsisConfig.allowToChangeInstallationDirectory === true) {
                console.log('✅ NSIS configuration is valid');
              } else {
                reject(new Error('NSIS configuration validation failed'));
                return;
              }
            } else {
              console.log('⚠️  NSIS configuration missing');
            }
            
            // Test DMG configuration for macOS
            if (packageJson.build.dmg) {
              const dmgConfig = packageJson.build.dmg;
              
              if (dmgConfig.contents && Array.isArray(dmgConfig.contents)) {
                console.log('✅ DMG configuration is valid');
              } else {
                reject(new Error('DMG configuration validation failed'));
                return;
              }
            } else {
              console.log('⚠️  DMG configuration missing');
            }
            
            resolve(true);
          });
        }
      };

      setTimeout(() => resolve(test.run()), 1000);
    });
  }

  testCodeSigning() {
    return new Promise((resolve) => {
      const test = {
        name: 'Code Signing Test',
        run: () => {
          return new Promise((resolve) => {
            const hasCertLink = !!process.env.CSC_LINK;
            const hasCertPassword = !!process.env.CSC_KEY_PASSWORD;
            const hasCertFile = !!process.env.CSC_FILE;
            
            console.log(`Certificate link: ${hasCertLink ? '✅ Set' : '❌ Not set'}`);
            console.log(`Certificate password: ${hasCertPassword ? '✅ Set' : '❌ Not set'}`);
            console.log(`Certificate file: ${hasCertFile ? '✅ Set' : '❌ Not set'}`);
            
            resolve(hasCertLink && hasCertPassword);
          });
        }
      };

      setTimeout(() => resolve(test.run()), 1000);
    });
  }

  printResults() {
    console.log('\n📊 Test Results Summary:');
    console.log('==================================');
    
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const total = this.testResults.length;
    
    console.log(`Total tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    
    if (failed > 0) {
      console.log('\n🔧 Failed Tests:');
      this.testResults
        .filter(r => r.status === 'failed')
        .forEach(r => console.log(`  - ${r.test}: ${r.error}`));
      
      console.log(`\n❌ ${failed}/${total} tests failed. Distribution system not ready.`);
      process.exit(1);
    } else {
      console.log(`\n✅ All ${total} tests passed! Distribution system is ready.`);
    }
    
    console.log('==================================');
  }
}

// Run tests
const tester = new DistributionTester();
tester.runAllTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});