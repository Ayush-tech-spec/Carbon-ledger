const fs = require('fs');

let html = fs.readFileSync('ar.html', 'utf8');

const replacements = [
  ['<button class="btn btn--primary" id="btn-scan-mode" onclick="ARApp.startScanMode()" disabled>',
   '<button class="btn btn--primary" id="btn-scan-mode" disabled>'],
  
  ['<button class="btn btn--outline" id="btn-3d-overlay" onclick="ARApp.startCamera3D()" disabled>',
   '<button class="btn btn--outline" id="btn-3d-overlay" disabled>'],
   
  ['<button class="btn btn--ghost" onclick="ARApp.startFallback()">',
   '<button class="btn btn--ghost" id="btn-fallback">'],
   
  ['<button class="btn btn--primary" id="btn-webxr" onclick="ARApp.startWebXR()" disabled style="display:none;">',
   '<button class="btn btn--primary hidden" id="btn-webxr" disabled>'],
   
  ['<button class="btn-close-cam" onclick="ARApp.exitCamera()">Exit</button>',
   '<button class="btn-close-cam" id="btn-exit-camera">Exit</button>'],
   
  ['<button class="result-close" onclick="ARApp.closeResult()" aria-label="Close result">&#x2715;</button>',
   '<button class="result-close" id="btn-close-result" aria-label="Close result">&#x2715;</button>'],
   
  ['<button class="btn-scan" id="btn-scan-capture" onclick="ARApp.captureAndScan()" aria-label="Scan object" title="Scan object"></button>',
   '<button class="btn-scan" id="btn-scan-capture" aria-label="Scan object" title="Scan object"></button>'],
   
  ['<button class="btn-cam-action active-mode" id="btn-mode-scan" onclick="ARApp.setMode(\'scan\')">',
   '<button class="btn-cam-action active-mode" id="btn-mode-scan">'],
   
  ['<button class="btn-cam-action" id="btn-mode-3d" onclick="ARApp.setMode(\'3d\')">',
   '<button class="btn-cam-action" id="btn-mode-3d">'],
   
  ['<button class="btn-place" id="btn-place" onclick="ARApp.placeScene()" disabled>Place here</button>',
   '<button class="btn-place" id="btn-place" disabled>Place here</button>'],
   
  ['<button class="btn-exit" onclick="ARApp.exitAR()">Exit</button>',
   '<button class="btn-exit" id="btn-exit-ar">Exit</button>'],
   
  ['<button class="fallback-close" onclick="ARApp.exitFallback()">Close</button>',
   '<button class="fallback-close" id="btn-exit-fallback">Close</button>']
];

for (let [orig, newStr] of replacements) {
  html = html.replace(orig, newStr);
}

fs.writeFileSync('ar.html', html);

// Update js/ar.js
let js = fs.readFileSync('js/ar.js', 'utf8');
const eventBindings = `
  document.getElementById('btn-scan-mode')?.addEventListener('click', () => ARApp.startScanMode());
  document.getElementById('btn-3d-overlay')?.addEventListener('click', () => ARApp.startCamera3D());
  document.getElementById('btn-fallback')?.addEventListener('click', () => ARApp.startFallback());
  document.getElementById('btn-webxr')?.addEventListener('click', () => ARApp.startWebXR());
  
  document.getElementById('btn-exit-camera')?.addEventListener('click', () => ARApp.exitCamera());
  document.getElementById('btn-close-result')?.addEventListener('click', () => ARApp.closeResult());
  document.getElementById('btn-scan-capture')?.addEventListener('click', () => ARApp.captureAndScan());
  document.getElementById('btn-mode-scan')?.addEventListener('click', () => ARApp.setMode('scan'));
  document.getElementById('btn-mode-3d')?.addEventListener('click', () => ARApp.setMode('3d'));
  
  document.getElementById('btn-place')?.addEventListener('click', () => ARApp.placeScene());
  document.getElementById('btn-exit-ar')?.addEventListener('click', () => ARApp.exitAR());
  document.getElementById('btn-exit-fallback')?.addEventListener('click', () => ARApp.exitFallback());
`;
js = js.replace('ARApp.init();', 'ARApp.init();' + eventBindings);
fs.writeFileSync('js/ar.js', js);

// Update css/ar.css
let css = fs.readFileSync('css/ar.css', 'utf8');
if (!css.includes('.hidden { display: none !important; }')) {
  css += '\\n\\n.hidden { display: none !important; }\\n';
  fs.writeFileSync('css/ar.css', css);
}

console.log('Refactoring complete');
