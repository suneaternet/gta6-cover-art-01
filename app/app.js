/* Vice Cover Studio — a GTA-poster-style cover maker.
   Static, offline, no network: photos are read on the user's own machine,
   fonts and samples are files under app/. The cover is drawn on canvas and
   exported as a PNG in the common post sizes. */

'use strict';

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const pctx = preview.getContext('2d');

/* ------------------------------------------------------------------ state */

const SAMPLES = [
  { src: 'samples/sunset-rider.jpg', name: 'Sunset rider' },
  { src: 'samples/neon-street.jpg', name: 'Neon street' },
  { src: 'samples/beach-duo.jpg', name: 'Beach duo' },
];

const LAYOUTS = {
  trio: [
    { x: 0, y: 0, w: 0.56, h: 1 },
    { x: 0.56, y: 0, w: 0.44, h: 0.5 },
    { x: 0.56, y: 0.5, w: 0.44, h: 0.5 },
  ],
  quad: [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  strip: [
    { x: 0, y: 0, w: 1, h: 0.62 },
    { x: 0, y: 0.62, w: 0.5, h: 0.38 },
    { x: 0.5, y: 0.62, w: 0.5, h: 0.38 },
  ],
};

const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

const state = {
  photos: [], // { img: HTMLImageElement, name: string }
  layout: 'trio',
  size: '1080x1080',
  grade: 'sunset',
  captionStyle: 'band',
  title: 'VICE NIGHTS',
  subtitle: 'Sunset chasers · est. 2026',
  titleScale: 1,
  selectedPanel: 0,
  // One entry per panel of the current layout; kept in step when the layout changes.
  panels: [],
};

function freshPanels(count) {
  const next = [];
  for (let i = 0; i < count; i++) {
    const old = state.panels[i];
    const keepPhoto = old && old.photo >= 0 && old.photo < state.photos.length;
    next.push({
      photo: keepPhoto ? old.photo : (state.photos.length ? i % state.photos.length : -1),
      zoom: old ? old.zoom : 1.15,
      panX: old ? old.panX : 0,
      panY: old ? old.panY : 0,
    });
  }
  return next;
}

function currentPanels() {
  const defs = LAYOUTS[state.layout];
  if (state.panels.length !== defs.length) state.panels = freshPanels(defs.length);
  return state.panels;
}

function selectedPanelState() {
  return currentPanels()[state.selectedPanel];
}

/* ------------------------------------------------------------- photo intake */

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, name: file.name || 'Photo' });
    img.onerror = () => reject(new Error('Could not read ' + (file.name || 'that image')));
    img.src = url;
  });
}

async function addFiles(files) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (!list.length) return;
  for (const file of list) {
    try {
      state.photos.push(await loadImageFile(file));
    } catch (err) {
      console.warn(err.message);
    }
  }
  // First photos fill the panels in order.
  state.panels = freshPanels(LAYOUTS[state.layout].length);
  renderTray();
  syncPanelControls();
  render();
}

async function loadSamples() {
  if (state.photos.length) return;
  for (const sample of SAMPLES) {
    try {
      const res = await fetch(sample.src);
      const blob = await res.blob();
      state.photos.push(await loadImageFile(new File([blob], sample.name, { type: blob.type })));
    } catch (err) {
      console.warn('Sample failed:', sample.src, err.message);
    }
  }
  state.panels = freshPanels(LAYOUTS[state.layout].length);
  renderTray();
  syncPanelControls();
  render();
}

/* ------------------------------------------------------------ photo tray UI */

function renderTray() {
  const tray = $('photoTray');
  tray.innerHTML = '';
  if (!state.photos.length) {
    tray.innerHTML = '<p class="muted">No photos yet.</p>';
    return;
  }
  const sel = selectedPanelState();
  state.photos.forEach((photo, i) => {
    const thumb = document.createElement('img');
    thumb.src = photo.img.src;
    thumb.alt = photo.name;
    thumb.title = photo.name + ' — click to put it in the selected panel';
    if (sel && sel.photo === i) thumb.classList.add('selected');
    if (currentPanels().some((p) => p.photo === i)) thumb.classList.add('assigned');
    thumb.addEventListener('click', () => {
      selectedPanelState().photo = i;
      renderTray();
      render();
    });
    tray.appendChild(thumb);
  });
}

/* --------------------------------------------------------------- cover draw */

/** Cover-fit draw of one photo into a panel rect, with the panel's zoom/pan. */
function drawPhotoInto(ctx, photo, rect, panel, grade) {
  const img = photo.img;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(rect.w / iw, rect.h / ih) * panel.zoom;
  const dw = iw * base;
  const dh = ih * base;
  // Clamp the pan so the photo always covers the panel.
  const maxX = Math.max(0, (dw - rect.w) / 2);
  const maxY = Math.max(0, (dh - rect.h) / 2);
  const px = Math.max(-maxX, Math.min(maxX, panel.panX * rect.w));
  const py = Math.max(-maxY, Math.min(maxY, panel.panY * rect.h));
  const dx = rect.x + (rect.w - dw) / 2 + px;
  const dy = rect.y + (rect.h - dh) / 2 + py;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = grade === 'mono' ? 'grayscale(1) contrast(1.12) brightness(1.05)' : 'none';
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** A simple original palm silhouette, drawn from paths — no borrowed art. */
function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  // Trunk, leaning.
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(14, -60, 34, -108);
  ctx.stroke();
  // Fronds: slender pointed leaves fanning from the crown.
  const crownX = 34;
  const crownY = -108;
  const leaves = [
    [-168, 92], [-142, 108], [-116, 118], [-90, 122],
    [-64, 116], [-38, 104], [-12, 88],
  ];
  for (const [deg, len] of leaves) {
    const a = (deg * Math.PI) / 180;
    const tipX = crownX + Math.cos(a) * len;
    const tipY = crownY + Math.sin(a) * len + 26; // gentle droop at the tip
    const midX = crownX + Math.cos(a) * len * 0.55;
    const midY = crownY + Math.sin(a) * len * 0.55 + 8;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(midX, midY - 14, tipX, tipY);
    ctx.quadraticCurveTo(midX, midY + 8, crownX, crownY);
    ctx.fill();
  }
  ctx.restore();
}

/** Colour-grade overlay across the whole cover. */
function gradeOverlay(ctx, W, H, grade) {
  ctx.save();
  if (grade === 'sunset') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255, 120, 40, 0)');
    g.addColorStop(0.55, 'rgba(255, 90, 60, 0.10)');
    g.addColorStop(1, 'rgba(255, 40, 130, 0.22)');
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    const warm = ctx.createLinearGradient(0, H * 0.5, 0, H);
    warm.addColorStop(0, 'rgba(255, 140, 60, 0)');
    warm.addColorStop(1, 'rgba(255, 90, 40, 0.16)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, W, H);
  } else if (grade === 'neon') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, 'rgba(255, 46, 136, 0.20)');
    g.addColorStop(0.5, 'rgba(120, 40, 255, 0.08)');
    g.addColorStop(1, 'rgba(46, 230, 214, 0.20)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  } else if (grade === 'teal') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(46, 230, 214, 0.14)');
    g.addColorStop(1, 'rgba(10, 40, 70, 0.28)');
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  // Gentle vignette for every grade.
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0, 0, 0, 0)');
  v.addColorStop(1, 'rgba(10, 2, 20, 0.34)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** The caption: big slanted display title + subtitle, over a sunset band. */
function drawCaption(ctx, W, H) {
  const bandH = H * 0.24;
  const bandY = H - bandH;
  const title = (state.title || 'VICE NIGHTS').toUpperCase();
  const sub = state.subtitle || '';
  const titlePx = Math.round(W * 0.105 * state.titleScale);

  if (state.captionStyle === 'band') {
    const g = ctx.createLinearGradient(0, bandY - H * 0.06, 0, H);
    g.addColorStop(0, 'rgba(40, 8, 60, 0)');
    g.addColorStop(0.35, 'rgba(120, 20, 90, 0.72)');
    g.addColorStop(1, 'rgba(30, 4, 44, 0.94)');
    ctx.fillStyle = g;
    ctx.fillRect(0, bandY - H * 0.06, W, bandH + H * 0.06);
    // Setting sun behind the title.
    const sunR = W * 0.085;
    const sunX = W * 0.84;
    const sunY = bandY + bandH * 0.34;
    const sg = ctx.createRadialGradient(sunX, sunY, sunR * 0.1, sunX, sunY, sunR);
    sg.addColorStop(0, 'rgba(255, 214, 120, 0.95)');
    sg.addColorStop(0.55, 'rgba(255, 120, 60, 0.85)');
    sg.addColorStop(1, 'rgba(255, 46, 136, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    drawPalm(ctx, W * 0.06, H * 0.985, W * 0.0011, 'rgba(16, 4, 28, 0.9)');
    drawPalm(ctx, W * 0.97, H * 0.99, W * 0.0008, 'rgba(16, 4, 28, 0.85)');
  } else if (state.captionStyle === 'clean') {
    const g = ctx.createLinearGradient(0, bandY, 0, H);
    g.addColorStop(0, 'rgba(10, 2, 20, 0)');
    g.addColorStop(1, 'rgba(10, 2, 20, 0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, bandY, W, bandH);
  }

  ctx.save();
  ctx.translate(W * 0.05, bandY + bandH * 0.52);
  ctx.transform(1, 0, -0.09, 1, 0, 0); // slight forward slant
  ctx.font = `${titlePx}px Anton, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 46, 136, 0.65)';
  ctx.shadowBlur = titlePx * 0.22;
  ctx.shadowOffsetY = titlePx * 0.04;
  if (state.captionStyle === 'outline') {
    ctx.lineWidth = Math.max(2, titlePx * 0.09);
    ctx.strokeStyle = '#16041f';
    ctx.strokeText(title, 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, 0, 0);
  } else {
    ctx.lineWidth = Math.max(2, titlePx * 0.07);
    ctx.strokeStyle = 'rgba(22, 4, 31, 0.9)';
    ctx.strokeText(title, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, 0, 0);
  }
  ctx.restore();

  if (sub) {
    ctx.save();
    ctx.font = `700 ${Math.round(W * 0.028)}px Archivo, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = state.grade === 'neon' ? '#2ee6d6' : '#ffd9a0';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 6;
    ctx.fillText(sub.toUpperCase(), W * 0.055, bandY + bandH * 0.86);
    ctx.restore();
  }
}

/** Draw the whole cover onto ctx at W×H. `forExport` skips editor-only marks. */
function drawCover(ctx, W, H, forExport) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0414';
  ctx.fillRect(0, 0, W, H);
  const defs = LAYOUTS[state.layout];
  const panels = currentPanels();
  const gutter = Math.max(2, Math.round(W * 0.006));
  defs.forEach((def, i) => {
    const rect = {
      x: def.x * W + gutter / 2,
      y: def.y * H + gutter / 2,
      w: def.w * W - gutter,
      h: def.h * H - gutter,
    };
    const panel = panels[i];
    const photo = panel && panel.photo >= 0 ? state.photos[panel.photo] : null;
    if (photo) {
      drawPhotoInto(ctx, photo, rect, panel, state.grade);
    } else {
      ctx.fillStyle = '#1c0f2e';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(247, 238, 252, 0.55)';
      ctx.font = `600 ${Math.round(W * 0.022)}px Archivo, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Drop a photo here', rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.textAlign = 'left';
    }
    if (!forExport && i === state.selectedPanel) {
      ctx.save();
      ctx.strokeStyle = '#ff2e88';
      ctx.lineWidth = Math.max(3, W * 0.006);
      ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
      ctx.restore();
    }
  });
  gradeOverlay(ctx, W, H, state.grade);
  drawCaption(ctx, W, H);
}

/* ------------------------------------------------------------ preview + UI */

function previewSize() {
  const [w, h] = SIZES[state.size];
  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return [Math.round(w * scale), Math.round(h * scale)];
}

function render() {
  const [w, h] = previewSize();
  if (preview.width !== w || preview.height !== h) {
    preview.width = w;
    preview.height = h;
  }
  drawCover(pctx, w, h, false);
  $('dropHint').style.display = state.photos.length ? 'none' : 'block';
  $('panelLabel').textContent = `Panel ${state.selectedPanel + 1} of ${LAYOUTS[state.layout].length}`;
}

function syncPanelControls() {
  const panel = selectedPanelState();
  if (!panel) return;
  $('zoomRange').value = String(panel.zoom);
  $('zoomVal').textContent = panel.zoom.toFixed(2) + '×';
  $('panXRange').value = String(panel.panX);
  $('panXVal').textContent = panel.panX.toFixed(2);
  $('panYRange').value = String(panel.panY);
  $('panYVal').textContent = panel.panY.toFixed(2);
  $('titleSizeVal').textContent = Math.round(state.titleScale * 100) + '%';
}

/** Export the cover at full size, download it and show it in the app. */
async function exportCover() {
  const [w, h] = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  await document.fonts.ready;
  drawCover(off.getContext('2d'), w, h, true);
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vice-cover-${state.size}.png`;
  a.click();
  $('exportImg').src = url;
  $('exportMeta').textContent = `${w} × ${h} PNG · ${Math.round(blob.size / 1024)} KiB · layout ${state.layout} · grade ${state.grade}`;
  $('exportView').hidden = false;
  $('exportView').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  // Hook for automated screenshots: the last export, with its size.
  window.__lastExport = { width: w, height: h, url, bytes: blob.size };
}

/* -------------------------------------------------------------- hit testing */

function panelAt(clientX, clientY) {
  const r = preview.getBoundingClientRect();
  const x = (clientX - r.left) / r.width;
  const y = (clientY - r.top) / r.height;
  const defs = LAYOUTS[state.layout];
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return i;
  }
  return -1;
}

let drag = null; // { panel, lastX, lastY, moved }

preview.addEventListener('pointerdown', (e) => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  state.selectedPanel = i;
  syncPanelControls();
  renderTray();
  render();
  drag = { panel: i, lastX: e.clientX, lastY: e.clientY, moved: false };
  preview.setPointerCapture(e.pointerId);
});

preview.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const r = preview.getBoundingClientRect();
  const def = LAYOUTS[state.layout][drag.panel];
  const panel = currentPanels()[drag.panel];
  if (!panel) return;
  const dx = (e.clientX - drag.lastX) / (r.width * def.w);
  const dy = (e.clientY - drag.lastY) / (r.height * def.h);
  if (Math.abs(e.clientX - drag.lastX) + Math.abs(e.clientY - drag.lastY) > 2) drag.moved = true;
  panel.panX = Math.max(-0.5, Math.min(0.5, panel.panX + dx));
  panel.panY = Math.max(-0.5, Math.min(0.5, panel.panY + dy));
  drag.lastX = e.clientX;
  drag.lastY = e.clientY;
  syncPanelControls();
  render();
});

preview.addEventListener('pointerup', () => { drag = null; });

preview.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = selectedPanelState();
  if (!panel) return;
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  syncPanelControls();
  render();
}, { passive: false });

/* ------------------------------------------------------------------ wiring */

$('fileInput').addEventListener('change', (e) => {
  addFiles(e.target.files);
  e.target.value = '';
});

$('sampleBtn').addEventListener('click', loadSamples);
$('demoBtn').addEventListener('click', loadSamples);
$('exportBtn').addEventListener('click', exportCover);
$('closeExport').addEventListener('click', () => { $('exportView').hidden = true; });

document.querySelectorAll('#layoutSeg .seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#layoutSeg .seg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.layout = btn.dataset.layout;
    state.selectedPanel = 0;
    state.panels = freshPanels(LAYOUTS[state.layout].length);
    syncPanelControls();
    renderTray();
    render();
  });
});

document.querySelectorAll('#sizeSeg .seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#sizeSeg .seg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.size = btn.dataset.size;
    render();
  });
});

document.querySelectorAll('#gradeSeg .seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#gradeSeg .seg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.grade = btn.dataset.grade;
    render();
  });
});

document.querySelectorAll('#captionSeg .seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#captionSeg .seg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.captionStyle = btn.dataset.caption;
    render();
  });
});

$('zoomRange').addEventListener('input', (e) => {
  const panel = selectedPanelState();
  if (!panel) return;
  panel.zoom = Number(e.target.value);
  $('zoomVal').textContent = panel.zoom.toFixed(2) + '×';
  render();
});
$('panXRange').addEventListener('input', (e) => {
  const panel = selectedPanelState();
  if (!panel) return;
  panel.panX = Number(e.target.value);
  $('panXVal').textContent = panel.panX.toFixed(2);
  render();
});
$('panYRange').addEventListener('input', (e) => {
  const panel = selectedPanelState();
  if (!panel) return;
  panel.panY = Number(e.target.value);
  $('panYVal').textContent = panel.panY.toFixed(2);
  render();
});
$('titleSizeRange').addEventListener('input', (e) => {
  state.titleScale = Number(e.target.value);
  $('titleSizeVal').textContent = Math.round(state.titleScale * 100) + '%';
  render();
});

$('titleInput').addEventListener('input', (e) => { state.title = e.target.value; render(); });
$('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; render(); });

$('fillAllBtn').addEventListener('click', () => {
  const panel = selectedPanelState();
  if (!panel || panel.photo < 0) return;
  currentPanels().forEach((p) => { p.photo = panel.photo; });
  renderTray();
  render();
});

$('swapBtn').addEventListener('click', () => {
  const panel = selectedPanelState();
  if (!panel || !state.photos.length) return;
  panel.photo = ((panel.photo < 0 ? -1 : panel.photo) + 1) % state.photos.length;
  renderTray();
  render();
});

// Drag-and-drop photos onto the stage.
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});

// Keyboard: nudge the selected photo with the arrow keys, zoom with + / -.
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const panel = selectedPanelState();
  if (!panel) return;
  const step = 0.03;
  if (e.key === 'ArrowLeft') { panel.panX = Math.max(-0.5, panel.panX - step); }
  else if (e.key === 'ArrowRight') { panel.panX = Math.min(0.5, panel.panX + step); }
  else if (e.key === 'ArrowUp') { panel.panY = Math.max(-0.5, panel.panY - step); }
  else if (e.key === 'ArrowDown') { panel.panY = Math.min(0.5, panel.panY + step); }
  else if (e.key === '+' || e.key === '=') { panel.zoom = Math.min(3, panel.zoom * 1.08); }
  else if (e.key === '-' || e.key === '_') { panel.zoom = Math.max(1, panel.zoom / 1.08); }
  else return;
  e.preventDefault();
  syncPanelControls();
  render();
});

/* -------------------------------------------------------------------- boot */

async function boot() {
  try {
    await Promise.all([
      document.fonts.load('400 80px Anton'),
      document.fonts.load('700 20px Archivo'),
      document.fonts.ready,
    ]);
  } catch (err) {
    console.warn('Font load failed, using fallbacks:', err.message);
  }
  render();
  const params = new URLSearchParams(location.search);
  if (params.has('demo') || params.has('shot')) {
    await loadSamples();
    if (params.get('shot') === 'export') {
      await exportCover();
      document.title = 'Vice Cover Studio — exported';
    }
  }
  window.__viceReady = true;
}

boot();
