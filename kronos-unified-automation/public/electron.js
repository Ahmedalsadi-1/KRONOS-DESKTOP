// CRA preset expects public/electron.js to be copied into build/electron.js
// Delegate to the actual Electron main process implementation.
require('../src/main/kronos-main.js');
