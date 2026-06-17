'use strict';

/*** ARApp: camera + AI vision + 3D carbon visualiser
 * Modes:
 *   scan     - camera open, tap to scan object with Gemini Vision
 *   3d       - camera open, Three.js 3D footprint overlay
 *   webxr    - full WebXR (Android + ARCore only)
 *   fallback - Three.js only, no camera
 */
const ARApp = (() => {
  'use strict';

  // ── Config ──────────────────────────────────────────────────
  const BACKEND = (typeof window !== 'undefined' && window.CARBON_LEDGER_BACKEND_URL)
    || 'https://carbon-ledger-4i6w.onrender.com';

  const COLORS = {
    transport: 0xe53935, food: 0xfb8c00,
    energy: 0xfdd835, shopping: 0x8e24aa, offset: 0x4caf50,
  };

  // ── State ───────────────────────────────────────────────────
  let _mode       = 'scan'; // 'scan' | '3d'
  let _stream     = null;
  let _renderer   = null;
  let _scene      = null;
  let _camera3d   = null;
  let _animFrames = [];
  let _scanning   = false;

  // WebXR
  let _xrSession  = null;
  let _hitTestSrc = null;
  let _xrRefSpace = null;
  let _reticle    = null;
  let _placed     = false;

  let _carbonData = null;

  // ── Boot ────────────────────────────────────────────────────

  function init() {
    Store.load();
    _carbonData = { totals: Store.getTotals(), cats: Store.getCategoryTotals() };

    const net = _carbonData.totals.net;
    const netEl = document.getElementById('ar-net-val');
    if (netEl) netEl.textContent = `${net.toFixed(1)} kg`;

    _checkCapabilities();
  }

  async function _checkCapabilities() {
    const noteEl    = document.getElementById('support-note');
    const pillWXR   = document.getElementById('pill-webxr');
    const pillCam   = document.getElementById('pill-camera');
    const btnScan   = document.getElementById('btn-scan-mode');
    const btn3D     = document.getElementById('btn-3d-overlay');
    const btnWebXR  = document.getElementById('btn-webxr');

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Camera
    const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    if (hasCamera) {
      pillCam.textContent = 'Camera: available';
      pillCam.className   = 'pill pill--active';
      btnScan.disabled    = false;
      btn3D.disabled      = false;
    } else {
      pillCam.textContent = 'Camera: unavailable';
      if (noteEl) noteEl.textContent = 'Camera not available. Use the 3D view below.';
    }

    // WebXR
    if (navigator.xr) {
      try {
        const ok = await navigator.xr.isSessionSupported('immersive-ar');
        if (ok) {
          pillWXR.textContent = 'WebXR: ready';
          pillWXR.className   = 'pill pill--active';
          btnWebXR.style.display = '';
          btnWebXR.disabled   = false;
        } else {
          pillWXR.textContent = 'WebXR: unsupported';
        }
      } catch (_e) {
        pillWXR.textContent = 'WebXR: error';
      }
    } else {
      pillWXR.textContent = 'WebXR: not available';
    }

    if (noteEl && hasCamera) {
      noteEl.textContent = isIOS
        ? 'On iPhone: open in Safari for best AR support. Camera scanning works in any browser!'
        : 'Camera ready! Tap "Scan Objects with AI" to identify objects and see their CO2 impact.';
    }
  }

  // ── Camera open/close ────────────────────────────────────────

  /**
   * Initializes the camera feed and binds it to the video element.
   * @returns {Promise<boolean>} True if camera started successfully, false otherwise.
   */
  async function _openCamera() {
    try {
      _stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        alert(
          'Camera access denied!\n\n' +
          'To fix:\n' +
          '• Chrome: click the camera icon in the address bar and allow\n' +
          '• iPhone: Settings > Safari > Camera > Allow\n' +
          '• Then refresh and try again.'
        );
      } else {
        alert(`Camera error: ${err.message}`);
      }
      return false;
    }

    const video = document.getElementById('camera-video');
    video.srcObject = _stream;
    await video.play().catch(() => {});
    return true;
  }

  /**
   * Cleans up the camera stream and video element.
   */
  function _closeCamera() {
    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }
    const video = document.getElementById('camera-video');
    video.srcObject = null;
  }

  // ── Mode: Scan Objects ───────────────────────────────────────

  /**
   * Starts the AR scan mode, opening the camera and showing the scan UI.
   */
  async function startScanMode() {
    const ok = await _openCamera();
    if (!ok) return;

    _mode = 'scan';
    document.getElementById('splash').style.display  = 'none';
    document.getElementById('camera-view').classList.add('active');
    document.getElementById('scan-ui').style.display = 'flex';
    document.getElementById('three-canvas').style.display = 'none';
    document.getElementById('cam-mode-label').textContent = 'Object Scanner';
    document.getElementById('btn-mode-scan').classList.add('active-mode');
    document.getElementById('btn-mode-3d').classList.remove('active-mode');
  }

  // ── Mode: 3D Overlay ─────────────────────────────────────────

  /**
   * Starts the 3D footprint overlay mode using the camera feed.
   */
  async function startCamera3D() {
    const ok = await _openCamera();
    if (!ok) return;

    _mode = '3d';
    document.getElementById('splash').style.display  = 'none';
    document.getElementById('camera-view').classList.add('active');
    document.getElementById('scan-ui').style.display = 'none';
    document.getElementById('cam-mode-label').textContent = '3D Footprint';
    document.getElementById('btn-mode-3d').classList.add('active-mode');
    document.getElementById('btn-mode-scan').classList.remove('active-mode');

    _setup3DOverlay();
  }

  /** Switch between scan and 3D mode without closing the camera */
  /**
   * Switches between 'scan' and '3d' mode without closing the camera.
   * @param {'scan'|'3d'} mode - The target mode
   */
  async function setMode(mode) {
    _mode = mode;
    const scanUI   = document.getElementById('scan-ui');
    const canvas   = document.getElementById('three-canvas');
    const btnScan  = document.getElementById('btn-mode-scan');
    const btn3D    = document.getElementById('btn-mode-3d');
    const modeLabel= document.getElementById('cam-mode-label');
    const scanBtn  = document.getElementById('btn-scan-capture');

    if (mode === 'scan') {
      scanUI.style.display    = 'flex';
      canvas.style.display    = 'none';
      scanBtn.style.display   = 'block';
      modeLabel.textContent   = 'Object Scanner';
      btnScan.classList.add('active-mode');
      btn3D.classList.remove('active-mode');
      closeResult();
    } else {
      scanUI.style.display    = 'none';
      canvas.style.display    = 'block';
      scanBtn.style.display   = 'none';
      modeLabel.textContent   = '3D Footprint';
      btn3D.classList.add('active-mode');
      btnScan.classList.remove('active-mode');

      if (!_renderer) _setup3DOverlay();
    }
  }

  function _setup3DOverlay() {
    const canvas = document.getElementById('three-canvas');
    canvas.style.display = 'block';
    canvas.classList.add('interactive');

    _scene    = new THREE.Scene();
    _camera3d = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
    _camera3d.position.set(0, 1.2, 2);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const dir     = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(3, 5, 4);
    _scene.add(ambient, dir);

    _renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _renderer.setSize(window.innerWidth, window.innerHeight);
    _renderer.setClearColor(0x000000, 0);

    _buildCarbonScene(new THREE.Vector3(0, -0.3, -2));
    _setupOrbitControls(canvas, _camera3d, new THREE.Vector3(0, 0.1, -2));

    const loop = () => {
      _renderer.render(_scene, _camera3d);
      const id = requestAnimationFrame(loop);
      _animFrames.push(id);
    };
    loop();

    window.addEventListener('resize', () => {
      if (!_renderer) return;
      _camera3d.aspect = window.innerWidth / window.innerHeight;
      _camera3d.updateProjectionMatrix();
      _renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /**
   * Exits the camera view (both scan and 3d modes) and cleans up resources.
   */
  function exitCamera() {
    _animFrames.forEach(id => cancelAnimationFrame(id));
    _animFrames = [];
    _closeCamera();
    if (_renderer) { _renderer.dispose(); _renderer = null; }
    _scene = null;
    document.getElementById('camera-view').classList.remove('active');
    document.getElementById('vision-result').classList.remove('visible');
    document.getElementById('splash').style.display = 'flex';
  }

  // ── AI Vision: Gemini ────────────────────────────────────────

  /**
   * Captures a frame from the video feed, sends it to the backend
   * Gemini Vision endpoint, and shows the result card.
   */
  async function captureAndScan() {
    if (_scanning) return;
    _scanning = true;

    const btn  = document.getElementById('btn-scan-capture');
    const hint = document.getElementById('scan-hint-text');
    btn.classList.add('scanning');
    btn.disabled  = true;
    hint.replaceChildren();
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    hint.appendChild(spinner);
    hint.appendChild(document.createTextNode(' Identifying object...'));

    // Capture frame from video
    const video  = document.getElementById('camera-video');
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64 JPEG (lower quality to keep payload small)
    const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

    try {
      const res = await fetch(`${BACKEND}/api/vision`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: base64, mimeType: 'image/jpeg' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Vision API error ${res.status}`);
      }

      const data = await res.json();
      _showResult(data);
      hint.textContent = 'Tap to scan another object';

    } catch (err) {
      hint.textContent = `Scan failed: ${err.message}`;
      setTimeout(() => { hint.textContent = 'Point at any object and tap the button'; }, 3000);
    } finally {
      btn.classList.remove('scanning');
      btn.disabled = false;
      _scanning    = false;
    }
  }

  /**
   * Displays the vision result card with object name, CO2 badge, and tip.
   * @param {{ object, co2Level, impact, tip }} data
   */
  function _showResult(data) {
    const card    = document.getElementById('vision-result');
    const objEl   = document.getElementById('result-object');
    const badgeEl = document.getElementById('result-badge');
    const impEl   = document.getElementById('result-impact');
    const tipEl   = document.getElementById('result-tip-text');

    objEl.textContent = data.object || 'Unknown object';
    impEl.textContent = data.impact || '';
    tipEl.textContent = data.tip    || '';

    const level = (data.co2Level || 'medium').toLowerCase();
    badgeEl.className   = `result-co2-badge badge-${level}`;
    badgeEl.textContent = level === 'high' ? 'High CO2'
                        : level === 'low'  ? 'Low CO2'
                        : 'Medium CO2';

    card.classList.add('visible');
  }

  function closeResult() {
    document.getElementById('vision-result').classList.remove('visible');
  }

  // ── Mode: WebXR ──────────────────────────────────────────────

  /**
   * Starts the full WebXR immersive AR experience.
   */
  async function startWebXR() {
    try {
      _xrSession = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay:       { root: document.getElementById('ar-overlay') },
      });
    } catch (err) {
      alert(`Could not start WebXR: ${err.message}\n\nTry "Scan Objects" or "3D overlay" instead.`);
      return;
    }

    // Three.js for WebXR
    _scene    = new THREE.Scene();
    _camera3d = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const dir     = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(3, 5, 4);
    _scene.add(ambient, dir);

    _renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _renderer.setSize(window.innerWidth, window.innerHeight);
    _renderer.xr.enabled = true;

    const gl = _renderer.getContext();
    await gl.makeXRCompatible();
    _renderer.xr.setReferenceSpaceType('local');
    await _renderer.xr.setSession(_xrSession);

    _xrRefSpace = await _xrSession.requestReferenceSpace('local');
    const viewer = await _xrSession.requestReferenceSpace('viewer');
    _hitTestSrc  = await _xrSession.requestHitTestSource({ space: viewer });

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.11, 32),
      new THREE.MeshBasicMaterial({ color: 0x4caf50, side: THREE.DoubleSide })
    );
    ring.matrixAutoUpdate = false;
    ring.visible = false;
    _reticle = ring;
    _scene.add(_reticle);

    _xrSession.addEventListener('end', _onXREnd);
    document.getElementById('splash').style.display = 'none';
    document.getElementById('ar-overlay').classList.add('active');

    _renderer.setAnimationLoop(_xrRenderLoop);
  }

  function _xrRenderLoop(_t, frame) {
    if (!frame) return;
    if (!_placed && _hitTestSrc) {
      const hits = frame.getHitTestResults(_hitTestSrc);
      if (hits.length) {
        const pose = hits[0].getPose(_xrRefSpace);
        if (pose) {
          _reticle.visible = true;
          _reticle.matrix.fromArray(pose.transform.matrix);
          document.getElementById('btn-place').disabled = false;
          document.getElementById('ar-hint').textContent = 'Surface found! Tap "Place here"';
        }
      } else {
        _reticle.visible = false;
        document.getElementById('btn-place').disabled = true;
        document.getElementById('ar-hint').textContent = 'Move phone slowly to detect a surface';
      }
    }
    _renderer.render(_scene, _camera3d);
  }

  /**
   * Places the 3D carbon scene at the reticle's location in WebXR.
   */
  function placeScene() {
    if (!_reticle || !_reticle.visible) return;
    const pos = new THREE.Vector3();
    const q   = new THREE.Quaternion();
    const s   = new THREE.Vector3();
    _reticle.matrix.decompose(pos, q, s);
    _buildCarbonScene(pos);
    _placed = true;
    _reticle.visible = false;
    document.getElementById('btn-place').disabled = true;
    document.getElementById('ar-hint').textContent = 'Walk around your carbon footprint!';
  }

  /**
   * Exits the WebXR session.
   */
  function exitAR() { if (_xrSession) _xrSession.end(); }

  function _onXREnd() {
    _xrSession = null; _hitTestSrc = null; _placed = false;
    document.getElementById('ar-overlay').classList.remove('active');
    document.getElementById('splash').style.display = 'flex';
    if (_renderer) { _renderer.setAnimationLoop(null); _renderer.dispose(); _renderer = null; }
  }

  // ── Mode: Fallback 3D ────────────────────────────────────────

  /**
   * Starts the fallback 3D view (no camera).
   */
  function startFallback() {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('fallback-wrap').classList.add('active');

    const canvas = document.getElementById('fallback-canvas');
    _scene    = new THREE.Scene();
    _camera3d = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
    _camera3d.position.set(0, 1.2, 2.5);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const dir     = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(3, 5, 4);
    _scene.add(ambient, dir);

    _renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _renderer.setSize(window.innerWidth, window.innerHeight);

    _buildCarbonScene(new THREE.Vector3(0, 0, -2));
    _setupOrbitControls(canvas, _camera3d, new THREE.Vector3(0, 0.2, -2));

    const loop = () => {
      _renderer.render(_scene, _camera3d);
      const id = requestAnimationFrame(loop);
      _animFrames.push(id);
    };
    loop();

    window.addEventListener('resize', () => {
      if (!_renderer) return;
      _camera3d.aspect = window.innerWidth / window.innerHeight;
      _camera3d.updateProjectionMatrix();
      _renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /**
   * Exits the fallback 3D view.
   */
  function exitFallback() {
    _animFrames.forEach(id => cancelAnimationFrame(id));
    _animFrames = [];
    if (_renderer) { _renderer.dispose(); _renderer = null; }
    document.getElementById('fallback-wrap').classList.remove('active');
    document.getElementById('splash').style.display = 'flex';
  }

  // ── Carbon 3D scene ──────────────────────────────────────────

  function _buildCarbonScene(origin) {
    const { totals, cats } = _carbonData;
    const SCALE   = 0.004;
    const SPACING = 0.28;
    const keys    = ['transport', 'food', 'energy', 'shopping'];
    const startX  = origin.x - ((keys.length - 1) * SPACING) / 2;

    keys.forEach((cat, i) => {
      const kg = cats[cat] || 0;
      if (kg <= 0) return;
      const h = Math.max(kg * SCALE, 0.05);
      const r = 0.06 + Math.min(kg * SCALE * 0.18, 0.07);

      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r * 1.2, h, 16),
        new THREE.MeshPhongMaterial({ color: COLORS[cat], shininess: 60, transparent: true, opacity: 0.88 })
      );
      mesh.position.set(startX + i * SPACING, origin.y + h / 2, origin.z);
      _scene.add(mesh);

      const lbl = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, 0.065),
        new THREE.MeshBasicMaterial({ map: _makeLabel(cat, `${kg.toFixed(0)} kg`), transparent: true, side: THREE.DoubleSide })
      );
      lbl.position.set(startX + i * SPACING, origin.y + h + 0.055, origin.z);
      _scene.add(lbl);

      let t = Math.random() * Math.PI * 2;
      const pulse = () => {
        t += 0.015;
        mesh.scale.y = 1 + Math.sin(t) * 0.04;
        const id = requestAnimationFrame(pulse);
        _animFrames.push(id);
      };
      pulse();
    });

    const netKg  = totals.net;
    const netR   = Math.max(Math.abs(netKg) * SCALE * 1.4, 0.055);
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(netR, 24, 24),
      new THREE.MeshPhongMaterial({ color: netKg > 0 ? 0xef5350 : 0x4caf50, shininess: 90, transparent: true, opacity: 0.78 })
    );
    sphere.position.set(origin.x, origin.y + 0.5, origin.z - 0.3);
    _scene.add(sphere);

    _addParticles(sphere.position, netKg > 0 ? 0xef5350 : 0x4caf50,
      Math.min(Math.floor(Math.abs(netKg) * 0.4), 50));

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(keys.length * SPACING * 0.5 + 0.04, keys.length * SPACING * 0.5 + 0.07, 64),
      new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(origin.x, origin.y + 0.001, origin.z);
    _scene.add(ring);
  }

  function _makeLabel(title, sub) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 80;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, 256, 80);
    ctx.fillStyle = '#fff'; ctx.font = '700 17px Courier New'; ctx.textAlign = 'center';
    ctx.fillText(title.toUpperCase(), 128, 28);
    ctx.fillStyle = '#aaa'; ctx.font = '13px Courier New';
    ctx.fillText(sub, 128, 54);
    return new THREE.CanvasTexture(c);
  }

  function _addParticles(center, color, count) {
    count = Math.max(count, 5);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 0.12 + Math.random() * 0.22;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI;
      pos[i*3]   = center.x + r * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = center.y + r * Math.sin(phi) * Math.sin(theta);
      pos[i*3+2] = center.z + r * Math.cos(phi);
    }
    const pts = new THREE.Points(
      (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return g; })(),
      new THREE.PointsMaterial({ color, size: 0.011, transparent: true, opacity: 0.65 })
    );
    _scene.add(pts);
    const spin = () => { pts.rotation.y += 0.004; const id = requestAnimationFrame(spin); _animFrames.push(id); };
    spin();
  }

  // ── Orbit controls ───────────────────────────────────────────

  function _setupOrbitControls(canvas, cam, target) {
    let isDrag = false, lx = 0, ly = 0;
    let theta = 0, phi = Math.PI / 4;
    const radius = 2.5;

    function update() {
      cam.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
      cam.position.y = target.y + radius * Math.cos(phi);
      cam.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
      cam.lookAt(target);
    }
    update();

    canvas.addEventListener('mousedown', e => { isDrag = true; lx = e.clientX; ly = e.clientY; });
    window.addEventListener('mouseup', () => { isDrag = false; });
    window.addEventListener('mousemove', e => {
      if (!isDrag) return;
      theta -= (e.clientX - lx) * 0.006;
      phi    = Math.max(0.1, Math.min(Math.PI - 0.1, phi - (e.clientY - ly) * 0.006));
      lx = e.clientX; ly = e.clientY; update();
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const d = new THREE.Vector3().subVectors(cam.position, target).normalize();
      cam.position.addScaledVector(d, e.deltaY * 0.003);
    }, { passive: false });

    let lt0 = 0, lt1 = 0, lpd = 0;
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) { lt0 = e.touches[0].clientX; lt1 = e.touches[0].clientY; }
      if (e.touches.length === 2) lpd = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1) {
        theta -= (e.touches[0].clientX - lt0) * 0.007;
        phi    = Math.max(0.1, Math.min(Math.PI - 0.1, phi - (e.touches[0].clientY - lt1) * 0.007));
        lt0 = e.touches[0].clientX; lt1 = e.touches[0].clientY; update();
      } else if (e.touches.length === 2) {
        const pd = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const d  = new THREE.Vector3().subVectors(cam.position, target).normalize();
        cam.position.addScaledVector(d, (lpd - pd) * 0.005);
        lpd = pd;
      }
    }, { passive: false });
  }

  return {
    init, startScanMode, startCamera3D, startFallback, startWebXR,
    setMode, exitCamera, exitFallback, exitAR,
    captureAndScan, closeResult, placeScene,
  };
})();

window.addEventListener('DOMContentLoaded', () => {
  // Pass backend URL to window before init
  window.CARBON_LEDGER_BACKEND_URL = 'https://carbon-ledger-4i6w.onrender.com';
  ARApp.init();
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

});