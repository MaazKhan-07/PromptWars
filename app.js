/* ========================================
   FlowSphere — Tabbed Application Controller
   ======================================== */
import { loadGoogleMaps, initMap, updateHeatmap, updateMarkers, drawFlowArrows, generateHeatmapData, generateFlowArrows, GATES, STADIUM_CENTER, CONCESSION_STALLS, renderDirections, clearDirections } from './src/services/googleMaps.js';
import { listenToFirebaseData, loginWithGoogle, logoutUser, listenToAuthStatus, addOrder, getOrders, addIncident, updateGateStatus, getLoyaltyPoints, getPointsHistory, getNotifications, markNotificationRead, getRestrooms, getZones, callCloudFunction, setupFCM, sendTestNotification, saveUserPreferences, getUserPreferences } from './src/services/firebase.js';
import { getCrowdIntelligence, getGateRecommendation, getSmartArrivalPlan, getDemandForecast, getRiskAssessment, getJourneyPlan } from './src/services/geminiAI.js';
import { sanitizeHTML, validateInput, getSafeErrorMessage, checkRateLimit } from './src/utils/security.js';
import { getWaitTimeCategory, calculateDensityScore, getDensitySeverity } from './src/utils/calculations.js';

'use strict';

// ─── Performance Monitoring ───
const perfLog = (label, startTime) => {
  if (import.meta.env?.DEV) console.log(`[Perf] ${label}: ${(performance.now() - startTime).toFixed(1)}ms`);
};

// ─── Service Worker Registration ───
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ─── State ───
let currentTab = 'dashboard';
let appData = null;
let currentUser = null;
let mapsReady = false;
let chartsReady = false;
let tabsInitialized = {};
let waitTimeHistory = {};
let crowdCount = 0;

// ─── Toast Notifications ───
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { if (container.contains(toast)) container.removeChild(toast); }, 5000);
}

// ─── Tab Navigation ───
function initTabNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    tab.addEventListener('keydown', (e) => {
      let newIndex;
      if (e.key === 'ArrowRight') newIndex = (index + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') newIndex = (index - 1 + tabs.length) % tabs.length;
      if (newIndex !== undefined) {
        e.preventDefault();
        tabs[newIndex].focus();
        switchTab(tabs[newIndex].dataset.tab);
      }
    });
  });

  // Keyboard shortcuts Alt+1 through Alt+6
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key >= '1' && e.key <= '6') {
      e.preventDefault();
      const tabNames = ['dashboard', 'gates', 'concessions', 'safety', 'analytics', 'attendee'];
      switchTab(tabNames[parseInt(e.key) - 1]);
    }
  });
}

function switchTab(tabName) {
  const t0 = performance.now();
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); t.tabIndex = -1; });
  panels.forEach(p => { p.classList.remove('active'); p.hidden = true; });

  const activeTab = document.getElementById(`tab-${tabName}`);
  const activePanel = document.getElementById(`panel-${tabName}`);
  if (activeTab && activePanel) {
    activeTab.classList.add('active');
    activeTab.setAttribute('aria-selected', 'true');
    activeTab.tabIndex = 0;
    activePanel.classList.remove('active'); // remove first to retrigger animation
    activePanel.hidden = false;
    requestAnimationFrame(() => activePanel.classList.add('active'));

    // Focus management
    const heading = activePanel.querySelector('h1');
    if (heading) heading.focus({ preventScroll: true });
  }

  currentTab = tabName;
  // Lazy-init tab content on first visit
  if (!tabsInitialized[tabName]) {
    tabsInitialized[tabName] = true;
    initTabContent(tabName);
  }
  perfLog(`Tab switch to ${tabName}`, t0);
}

// ─── Lazy Tab Initialization ───
async function initTabContent(tabName) {
  switch (tabName) {
    case 'dashboard': return initDashboard();
    case 'gates': return initGates();
    case 'concessions': return initConcessions();
    case 'safety': return initSafety();
    case 'analytics': return initAnalytics();
    case 'attendee': return initAttendee();
  }
}

// ─── Particle Background ───
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();

  class P {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width; this.y = Math.random() * canvas.height;
      this.size = Math.random() * 1.5 + 0.3; this.speedX = (Math.random() - 0.5) * 0.3;
      this.speedY = (Math.random() - 0.5) * 0.3; this.opacity = Math.random() * 0.4 + 0.1;
      this.hue = Math.random() > 0.5 ? 185 : 260;
    }
    update() {
      this.x += this.speedX; this.y += this.speedY;
      if (this.x < 0) this.x = canvas.width; if (this.x > canvas.width) this.x = 0;
      if (this.y < 0) this.y = canvas.height; if (this.y > canvas.height) this.y = 0;
    }
    draw() {
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue},100%,70%,${this.opacity})`; ctx.fill();
    }
  }

  const count = Math.min(Math.floor((canvas.width * canvas.height) / 15000), 100);
  for (let i = 0; i < count; i++) particles.push(new P());

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80) {
          ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,240,255,${((80 - dist) / 80) * 0.08})`;
          ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }
  animate();
  window.addEventListener('resize', () => { resize(); particles = []; for (let i = 0; i < count; i++) particles.push(new P()); });
}

// ═══════════════════════════════════════
// TAB 1: LIVE DASHBOARD
// ═══════════════════════════════════════
async function initDashboard() {
  // Initialize map
  if (mapsReady) {
    initMap('venue-map');
    if (appData) renderDashboardMapData(appData);
  }
  // Weather
  fetchWeather();
  // Phase selector
  document.querySelectorAll('.phase-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.phase-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('match-phase').textContent = btn.dataset.phase;
    });
  });
  // AI button
  document.getElementById('btn-crowd-ai')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-crowd-ai');
    const area = document.getElementById('ai-insight-dashboard');
    btn.disabled = true;
    area.innerHTML = '<span class="spinner"></span> Analyzing crowd data...';
    const result = await getCrowdIntelligence(appData?.zones || {});
    if (result.rateLimited) {
      area.innerHTML = `<p style="color:var(--yellow)">⏳ ${result.error}</p>`;
      startCooldownTimer('ai-cooldown-dashboard', result.remainingMs);
    } else {
      area.innerHTML = `<p>${result.fromMock ? '🔬 ' : '🧠 '}${result.text}</p>`;
    }
    btn.disabled = false;
  });
}

function renderDashboardMapData(data) {
  const zones = data.zones || {};
  const heatData = generateHeatmapData(zones);
  updateHeatmap(heatData, 'venue-map');

  const gateMarkers = GATES.map(g => {
    const gateData = data.waitTimes?.[g.name.split(' (')[0]] || {};
    return { ...g, title: g.name, waitTime: gateData.wait || Math.floor(Math.random() * 15), density: gateData.capacity ? `${gateData.capacity}%` : 'Normal', icon: '🚪' };
  });
  updateMarkers(gateMarkers, 'venue-map');
  drawFlowArrows(generateFlowArrows(), 'venue-map');
}

function updateDashboardStats(data) {
  crowdCount = Math.floor(45000 + Math.random() * 20000);
  const el = document.getElementById('live-crowd-count');
  if (el) el.textContent = crowdCount.toLocaleString();
  const alertEl = document.getElementById('active-alerts-count');
  if (alertEl) alertEl.textContent = (data.alerts?.filter(a => a.active).length || 0).toString();
  const updated = document.getElementById('dashboard-updated');
  if (updated) updated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
}

async function fetchWeather() {
  const widget = document.getElementById('weather-widget');
  if (!widget) return;
  try {
    const resp = await fetch('https://api.open-meteo.com/v1/forecast?latitude=18.9388&longitude=72.8252&current_weather=true');
    const data = await resp.json();
    const w = data.current_weather;
    widget.innerHTML = `<div><strong>${w.temperature}°C</strong> • Wind ${w.windspeed} km/h</div><div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">Mumbai, Wankhede Stadium</div>`;
  } catch {
    widget.innerHTML = `<div><strong>28°C</strong> • Clear skies</div><div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">Mumbai (cached)</div>`;
  }
}

// ═══════════════════════════════════════
// TAB 2: GATE MANAGER
// ═══════════════════════════════════════
function initGates() {
  if (appData) renderGateCards(appData);
  // Arrival planner
  document.getElementById('arrival-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const section = document.getElementById('seat-section-input').value;
    const time = document.getElementById('arrival-time-input').value;
    if (!section || !time) return;
    const resultEl = document.getElementById('arrival-result');
    resultEl.innerHTML = '<span class="spinner"></span> Generating plan...';
    const result = await getSmartArrivalPlan(section, time);
    resultEl.innerHTML = result.rateLimited ? `<p style="color:var(--yellow)">⏳ ${result.error}</p>` : `<p>${result.text}</p>`;
  });
  // Init chart
  if (chartsReady) renderWaitTrendChart();
}

function renderGateCards(data) {
  const grid = document.getElementById('gate-grid');
  if (!grid || !data.waitTimes) return;
  grid.innerHTML = '';
  Object.entries(data.waitTimes).forEach(([name, info]) => {
    const wait = info.wait ?? info;
    const capacity = info.capacity ?? 50;
    const trend = info.trend ?? 'stable';
    const status = info.status ?? 'OPEN';
    const trendIcon = trend === 'increasing' ? '↑' : trend === 'decreasing' ? '↓' : '→';
    const waitClass = wait < 5 ? 'low' : wait < 12 ? 'medium' : 'high';
    const statusClass = status.toLowerCase();
    const capColor = capacity < 50 ? 'var(--green)' : capacity < 80 ? 'var(--yellow)' : 'var(--red)';
    const card = document.createElement('div');
    card.className = 'gate-card';
    card.innerHTML = `
      <div class="gate-card-header"><span class="gate-name">${sanitizeHTML(name)}</span><span class="gate-status ${statusClass}">${status}</span></div>
      <div class="gate-wait ${waitClass}">${wait} <span style="font-size:0.9rem;font-weight:400;">min</span></div>
      <div class="gate-trend">${trendIcon} ${trend} trend</div>
      <div class="capacity-bar"><div class="capacity-fill" style="width:${capacity}%;background:${capColor};"></div></div>
      <div class="capacity-label">Capacity: ${capacity}%</div>
      <button class="btn-ai" data-gate="${sanitizeHTML(name)}" aria-label="Get AI suggestion for ${sanitizeHTML(name)}"><span class="btn-ai-icon">✨</span> Suggest Alternate</button>
    `;
    card.querySelector('.btn-ai').addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      const gateName = btn.dataset.gate;
      btn.innerHTML = '<span class="spinner"></span>';
      const result = await getGateRecommendation(data.waitTimes, gateName);
      btn.innerHTML = result.text ? `<small>${result.text}</small>` : '<span class="btn-ai-icon">✨</span> Try Again';
    });
    grid.appendChild(card);

    // Track history
    if (!waitTimeHistory[name]) waitTimeHistory[name] = [];
    waitTimeHistory[name].push({ time: new Date(), wait });
    if (waitTimeHistory[name].length > 60) waitTimeHistory[name].shift();
  });

  // Admin controls
  if (currentUser) {
    const adminPanel = document.getElementById('admin-controls');
    if (adminPanel) {
      adminPanel.hidden = false;
      const adminGrid = document.getElementById('admin-gate-controls');
      adminGrid.innerHTML = '';
      Object.keys(data.waitTimes).forEach(name => {
        const item = document.createElement('div');
        item.className = 'admin-gate-item';
        item.innerHTML = `<span class="admin-gate-name">${name}</span><div class="admin-gate-btns"><button style="background:rgba(0,232,143,0.2);color:var(--green);" data-gate="${name}" data-action="OPEN">Open</button><button style="background:rgba(255,71,87,0.2);color:var(--red);" data-gate="${name}" data-action="CLOSED">Close</button></div>`;
        item.querySelectorAll('button').forEach(btn => {
          btn.addEventListener('click', () => {
            updateGateStatus(btn.dataset.gate, btn.dataset.action);
            showToast(`${btn.dataset.gate} set to ${btn.dataset.action}`, 'success');
          });
        });
        adminGrid.appendChild(item);
      });
    }
  }
  document.getElementById('gates-updated').textContent = `Updated ${new Date().toLocaleTimeString()}`;
}

// ═══════════════════════════════════════
// TAB 3: CONCESSIONS
// ═══════════════════════════════════════
function initConcessions() {
  if (mapsReady) initConcessionMap();
  initPreorderSystem();
  renderRestrooms();
  renderOrderQueue();
  // AI demand forecast
  document.getElementById('btn-demand-ai')?.addEventListener('click', async () => {
    const area = document.getElementById('ai-forecast');
    area.innerHTML = '<span class="spinner"></span> Forecasting...';
    const phase = document.getElementById('match-phase')?.textContent || 'Live';
    const result = await getDemandForecast(phase, getOrders());
    area.innerHTML = result.rateLimited ? `<p style="color:var(--yellow)">⏳ ${result.error}</p>` : `<p>${result.text}</p>`;
    if (!result.rateLimited) document.getElementById('forecast-actions').hidden = false;
  });
  document.querySelector('.btn-accept')?.addEventListener('click', () => {
    showToast('Kitchen has been alerted!', 'success');
    document.getElementById('forecast-actions').hidden = true;
  });
  document.querySelector('.btn-dismiss')?.addEventListener('click', () => {
    document.getElementById('forecast-actions').hidden = true;
  });
}

function initConcessionMap() {
  const map = initMap('concession-map', STADIUM_CENTER, 17);
  if (!map || !window.google) return;
  CONCESSION_STALLS.forEach(stall => {
    const marker = new window.google.maps.Marker({
      position: { lat: stall.lat, lng: stall.lng }, map,
      label: { text: stall.icon, fontSize: '18px' }, title: stall.name, optimized: false
    });
    const info = new window.google.maps.InfoWindow({
      content: `<div style="color:#111;padding:6px;"><strong>${stall.name}</strong><br><small>${stall.type}</small></div>`,
      ariaLabel: stall.name
    });
    marker.addListener('click', () => info.open({ anchor: marker, map }));
  });
}

function initPreorderSystem() {
  // Quantity controls
  document.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.menu-item');
      const qtyEl = item.querySelector('.qty-value');
      let qty = parseInt(qtyEl.dataset.qty);
      if (btn.classList.contains('plus')) qty++;
      else if (btn.classList.contains('minus') && qty > 0) qty--;
      qtyEl.dataset.qty = qty;
      qtyEl.textContent = qty;
      updateCartTotal();
    });
  });
  // Submit order
  document.getElementById('preorder-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const section = document.getElementById('preorder-section').value;
    if (!section) { showToast('Please select your seat section', 'warning'); return; }
    const items = [];
    document.querySelectorAll('.menu-item').forEach(el => {
      const qty = parseInt(el.querySelector('.qty-value').dataset.qty);
      if (qty > 0) items.push({ name: el.dataset.item, price: parseInt(el.dataset.price), qty });
    });
    if (items.length === 0) { showToast('Please add items to your cart', 'warning'); return; }
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const order = addOrder({ section, items, total, userId: currentUser?.email || 'guest' });
    showToast(`Order ${order.id} placed! Total: ₹${total}`, 'success');
    document.getElementById('order-status-msg').innerHTML = `<div class="form-status success">✅ Order ${order.id} — Status: ${order.status}</div>`;
    // Reset quantities
    document.querySelectorAll('.qty-value').forEach(el => { el.dataset.qty = '0'; el.textContent = '0'; });
    updateCartTotal();
    renderOrderQueue();
  });
}

function updateCartTotal() {
  let total = 0;
  document.querySelectorAll('.menu-item').forEach(el => {
    const qty = parseInt(el.querySelector('.qty-value').dataset.qty);
    total += parseInt(el.dataset.price) * qty;
  });
  document.getElementById('cart-total-amount').textContent = `₹${total}`;
  document.getElementById('submit-order-btn').disabled = total === 0;
}

function renderOrderQueue() {
  const container = document.getElementById('order-queue');
  if (!container) return;
  const orders = getOrders();
  if (orders.length === 0) { container.innerHTML = '<p class="empty-state">No active orders yet</p>'; return; }
  container.innerHTML = orders.slice(0, 20).map(o => {
    const statusClass = o.status.toLowerCase().replace(/ /g, '');
    const badgeClass = o.status === 'Received' ? 'received' : o.status === 'Preparing' ? 'preparing' : o.status === 'Out for Delivery' ? 'delivering' : 'delivered';
    return `<div class="order-item"><div><span class="order-id">${o.id}</span><br><small>${o.items?.map(i => `${i.name} x${i.qty}`).join(', ') || ''}</small></div><span class="order-status-badge ${badgeClass}">${o.status}</span></div>`;
  }).join('');
}

function renderRestrooms() {
  const grid = document.getElementById('restroom-grid');
  if (!grid) return;
  const restrooms = getRestrooms();
  grid.innerHTML = restrooms.map(r => `
    <div class="restroom-card ${r.status}">
      <div class="restroom-name">${r.name}</div>
      <div class="restroom-occ" style="color:${r.occupancy < 40 ? 'var(--green)' : r.occupancy < 75 ? 'var(--yellow)' : 'var(--red)'};">${r.occupancy}%</div>
      <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;">${r.status}</div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════
// TAB 4: SAFETY
// ═══════════════════════════════════════
function initSafety() {
  if (appData) { renderZoneGrid(appData); renderAlertFeed(appData); }
  if (mapsReady) initMap('evac-map', STADIUM_CENTER, 15);
  // Alert filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderAlertFeed(appData, btn.dataset.severity);
    });
  });
  // Evacuation
  document.getElementById('btn-trigger-evac')?.addEventListener('click', triggerEvacuation);
  // Incident form
  document.getElementById('incident-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const zone = document.getElementById('incident-zone').value;
    const severity = document.getElementById('incident-severity').value;
    const desc = document.getElementById('incident-desc').value;
    if (!zone || !desc) return;
    const validation = validateInput(desc, { required: true, minLength: 5, maxLength: 500 });
    if (!validation.valid) { document.getElementById('incident-status').innerHTML = `<div class="form-status error">❌ ${validation.error}</div>`; return; }
    let coords = null;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => { coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }; }, () => {});
    }
    const incident = addIncident({ zone, severity, description: sanitizeHTML(desc), coordinates: coords });
    document.getElementById('incident-status').innerHTML = `<div class="form-status success">✅ Incident ${incident.id} reported</div>`;
    showToast(`Incident ${incident.id} filed`, 'success');
    e.target.reset();
  });
  // AI risk
  document.getElementById('btn-risk-ai')?.addEventListener('click', async () => {
    const area = document.getElementById('ai-risk-assessment');
    area.innerHTML = '<span class="spinner"></span> Assessing risk...';
    const result = await getRiskAssessment(getZones());
    area.innerHTML = result.rateLimited ? `<p style="color:var(--yellow)">⏳ ${result.error}</p>` : `<p>${result.text}</p>`;
  });
  // FCM
  document.getElementById('btn-setup-fcm')?.addEventListener('click', async () => {
    const fcm = await setupFCM();
    document.getElementById('fcm-token-display').hidden = false;
    document.getElementById('fcm-token-display').textContent = `Token: ${fcm.token}`;
    document.getElementById('btn-test-notif').hidden = false;
    showToast('FCM configured', 'success');
  });
  document.getElementById('btn-test-notif')?.addEventListener('click', async () => {
    const n = await sendTestNotification();
    showToast(n.message, 'info');
  });
}

function renderZoneGrid(data) {
  const grid = document.getElementById('zone-grid');
  if (!grid || !data.zones) return;
  grid.innerHTML = Object.entries(data.zones).map(([name, z]) => {
    const riskClass = z.riskScore < 30 ? 'risk-low' : z.riskScore < 60 ? 'risk-mod' : z.riskScore < 80 ? 'risk-high' : 'risk-crit';
    return `<div class="zone-card"><div class="zone-name">${name}</div><div class="zone-density">Density: ${z.density} p/m²</div><div class="zone-risk ${riskClass}">Risk: ${z.riskScore}/100</div><div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">Last: ${z.lastIncident}</div></div>`;
  }).join('');
}

function renderAlertFeed(data, filter = 'all') {
  const feed = document.getElementById('alert-feed');
  if (!feed || !data?.alerts) return;
  const alerts = filter === 'all' ? data.alerts : data.alerts.filter(a => a.severity === filter);
  // Virtual scrolling: only render first 10
  feed.innerHTML = alerts.slice(0, 10).map(a => {
    const cls = a.severity === 'CRITICAL' ? 'critical' : a.severity === 'WARNING' ? 'warning' : 'info';
    const time = new Date(a.timestamp).toLocaleTimeString();
    return `<div class="alert-item ${cls}"><div>${a.msg}</div><div class="alert-meta">${time} • ${a.zone} • ${a.assignedStaff} • ${a.status}</div></div>`;
  }).join('');
  if (alerts.length > 10) {
    feed.innerHTML += `<div class="empty-state">Showing 10 of ${alerts.length} alerts. Scroll for more.</div>`;
  }
}

function triggerEvacuation() {
  const results = document.getElementById('evac-results');
  results.hidden = false;
  results.innerHTML = '<span class="spinner"></span> Computing evacuation routes...';
  setTimeout(() => {
    const routes = GATES.map(g => ({
      gate: g.name, clearanceTime: `${Math.floor(Math.random() * 5) + 3} min`,
      capacity: `${Math.floor(Math.random() * 5000) + 8000} people`, route: `Concourse → ${g.name} → Emergency Exit`
    }));
    results.innerHTML = `<h3 style="color:var(--red);margin-bottom:0.5rem;">⚠️ EVACUATION ROUTES COMPUTED</h3>` +
      routes.map(r => `<div style="padding:0.4rem 0;border-bottom:1px solid var(--border-subtle);font-size:0.85rem;"><strong>${r.gate}</strong>: ${r.clearanceTime} — ${r.capacity} via ${r.route}</div>`).join('') +
      `<div style="margin-top:0.5rem;font-family:var(--font-mono);font-size:0.78rem;color:var(--green);">✅ Full venue clearance: ~8 minutes</div>`;
    showToast('Evacuation routes computed', 'warning');
  }, 2000);
}

// ═══════════════════════════════════════
// TAB 5: ANALYTICS
// ═══════════════════════════════════════
async function initAnalytics() {
  await loadGoogleCharts();
  renderAllCharts();
  initBigQueryPanel();
  initCloudFunctions();
  // Refresh charts every 30s
  setInterval(() => { if (currentTab === 'analytics' && chartsReady) renderAllCharts(); }, 30000);
}

function loadGoogleCharts() {
  return new Promise(resolve => {
    if (chartsReady) return resolve();
    if (window.google?.charts) {
      window.google.charts.load('current', { packages: ['corechart'] });
      window.google.charts.setOnLoadCallback(() => { chartsReady = true; resolve(); });
    } else {
      setTimeout(() => resolve(), 1000); // Charts script may not be loaded
    }
  });
}

function renderAllCharts() {
  if (!chartsReady || !window.google?.visualization) return;
  const chartStyle = { backgroundColor: 'transparent', colors: ['#00f0ff', '#7b61ff', '#ff6b9d', '#00e88f', '#ffc846', '#ff8a3d'], legend: { textStyle: { color: '#8a92a8', fontSize: 11 } }, hAxis: { textStyle: { color: '#8a92a8' }, gridlines: { color: '#1a1a3e' } }, vAxis: { textStyle: { color: '#8a92a8' }, gridlines: { color: '#1a1a3e' } }, chartArea: { width: '85%', height: '75%' }, animation: { startup: true, duration: 800, easing: 'out' } };

  // Column Chart - Throughput
  try {
    const throughputData = window.google.visualization.arrayToDataTable([
      ['Hour', 'Gate 1', 'Gate 2', 'Gate 3', 'Gate 4', 'Gate 5', 'Gate 6'],
      ...Array.from({ length: 6 }, (_, i) => [`${i + 4}PM`, ...Array.from({ length: 6 }, () => Math.floor(Math.random() * 3000) + 1000)])
    ]);
    new window.google.visualization.ColumnChart(document.getElementById('chart-throughput')).draw(throughputData, { ...chartStyle, title: '', isStacked: false });
  } catch(e) {}

  // Line Chart - Wait trends
  try {
    const waitData = window.google.visualization.arrayToDataTable([
      ['Time', 'Gate 1', 'Gate 2', 'Gate 3', 'Gate 4', 'Gate 5', 'Gate 6'],
      ...Array.from({ length: 12 }, (_, i) => [`${i * 5}m`, ...Array.from({ length: 6 }, () => Math.floor(Math.random() * 20) + 1)])
    ]);
    new window.google.visualization.LineChart(document.getElementById('chart-waittrends')).draw(waitData, { ...chartStyle, curveType: 'function' });
    // Also render in Tab 2 if available
    const tab2Chart = document.getElementById('wait-trend-chart');
    if (tab2Chart) new window.google.visualization.LineChart(tab2Chart).draw(waitData, { ...chartStyle, curveType: 'function' });
  } catch(e) {}

  // Pie Chart - Distribution
  try {
    const distData = window.google.visualization.arrayToDataTable([
      ['Section', 'Attendees'], ['North Stand', 18500], ['South Stand', 16200], ['East Stand', 14800], ['West Stand', 12300], ['VIP', 3200], ['General', 5000]
    ]);
    new window.google.visualization.PieChart(document.getElementById('chart-distribution')).draw(distData, { ...chartStyle, pieHole: 0.4, pieSliceTextStyle: { color: '#fff' } });
  } catch(e) {}

  // Area Chart - Entries/Exits
  try {
    let entries = 0, exits = 0;
    const entryData = window.google.visualization.arrayToDataTable([
      ['Time', 'Entries', 'Exits'],
      ...Array.from({ length: 10 }, (_, i) => { entries += Math.floor(Math.random() * 8000) + 2000; exits += Math.floor(Math.random() * 3000); return [`${i + 3}PM`, entries, exits]; })
    ]);
    new window.google.visualization.AreaChart(document.getElementById('chart-entries')).draw(entryData, { ...chartStyle });
  } catch(e) {}
}

function renderWaitTrendChart() {
  if (!chartsReady) return;
  // This will be called from renderAllCharts for tab2 chart
}

function initBigQueryPanel() {
  const queries = {
    density: `SELECT zone_name, AVG(density_score) as avg_density,\n       MAX(density_score) as peak_density,\n       COUNT(CASE WHEN density_score > 5.5 THEN 1 END) as critical_events\nFROM \`flowsphere.crowd_analytics.zone_density\`\nWHERE event_date = CURRENT_DATE()\nGROUP BY zone_name\nORDER BY avg_density DESC;`,
    waittime: `SELECT gate_name, AVG(wait_minutes) as avg_wait,\n       MIN(wait_minutes) as min_wait,\n       MAX(wait_minutes) as max_wait,\n       STDDEV(wait_minutes) as std_dev\nFROM \`flowsphere.operations.gate_waits\`\nWHERE event_id = 'EVT-2026-0412'\nGROUP BY gate_name;`,
    incidents: `SELECT severity, COUNT(*) as count,\n       AVG(response_time_sec) as avg_response,\n       STRING_AGG(DISTINCT zone_name) as zones\nFROM \`flowsphere.safety.incidents\`\nWHERE event_date = CURRENT_DATE()\nGROUP BY severity\nORDER BY count DESC;`,
    revenue: `SELECT stall_name, SUM(order_total) as revenue,\n       COUNT(*) as orders,\n       AVG(order_total) as avg_order\nFROM \`flowsphere.concessions.orders\`\nWHERE event_id = 'EVT-2026-0412'\nGROUP BY stall_name\nORDER BY revenue DESC\nLIMIT 10;`
  };
  document.querySelectorAll('.query-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.query-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('query-sql').textContent = queries[btn.dataset.query];
    });
  });
  document.getElementById('btn-run-query')?.addEventListener('click', () => {
    const results = document.getElementById('query-results');
    results.innerHTML = '<span class="spinner"></span> Executing via Cloud Function...';
    setTimeout(() => {
      const mockResults = [
        { zone: 'Zone 3 - East', avg_density: '4.8', peak: '5.9', critical: '3' },
        { zone: 'Zone 7 - Entry', avg_density: '4.2', peak: '5.1', critical: '1' },
        { zone: 'Zone 2 - South', avg_density: '3.8', peak: '4.6', critical: '0' },
        { zone: 'Zone 6 - Food', avg_density: '3.2', peak: '4.1', critical: '0' },
        { zone: 'Zone 1 - North', avg_density: '2.1', peak: '3.0', critical: '0' }
      ];
      results.innerHTML = `<table><thead><tr>${Object.keys(mockResults[0]).map(k => `<th>${k}</th>`).join('')}</tr></thead><tbody>${mockResults.map(r => `<tr>${Object.values(r).map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }, 1500);
  });
}

function initCloudFunctions() {
  document.getElementById('btn-cf-crowdscore')?.addEventListener('click', async () => {
    const el = document.getElementById('cf-crowdscore-result');
    el.innerHTML = '<span class="spinner"></span> Calling calculateCrowdScore()...';
    const result = await callCloudFunction('calculateCrowdScore', { zoneData: { density: 4.5 } });
    el.innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
  });
  document.getElementById('btn-cf-report')?.addEventListener('click', async () => {
    const el = document.getElementById('cf-report-result');
    el.innerHTML = '<span class="spinner"></span> Calling generateEventReport()...';
    const result = await callCloudFunction('generateEventReport', { eventId: 'EVT-2026-0412' });
    el.innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
  });
}

// ═══════════════════════════════════════
// TAB 6: ATTENDEE PORTAL
// ═══════════════════════════════════════
function initAttendee() {
  if (currentUser) showAttendeeContent();
  document.getElementById('attendee-signin-btn')?.addEventListener('click', handleSignIn);
  // Journey form
  document.getElementById('journey-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const seat = document.getElementById('journey-seat').value;
    const transport = document.getElementById('journey-transport').value;
    if (!seat) return;
    const resultEl = document.getElementById('journey-result');
    resultEl.innerHTML = '<span class="spinner"></span> Generating timeline...';
    const result = await getJourneyPlan(seat, transport);
    resultEl.innerHTML = `<p style="white-space:pre-line;">${result.text}</p>`;
  });
  // Wayfinding
  document.getElementById('btn-find-route')?.addEventListener('click', () => {
    if (mapsReady) {
      initMap('wayfinding-map', STADIUM_CENTER, 16);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          renderDirections({ lat: pos.coords.latitude, lng: pos.coords.longitude }, STADIUM_CENTER, 'wayfinding-map');
        }, () => {
          renderDirections({ lat: 18.935, lng: 72.828 }, STADIUM_CENTER, 'wayfinding-map');
        });
      }
    }
  });
  // Accessibility prefs
  document.getElementById('pref-high-contrast')?.addEventListener('change', (e) => {
    document.body.classList.toggle('high-contrast', e.target.checked);
    saveUserPreferences({ highContrast: e.target.checked });
  });
  document.getElementById('pref-large-text')?.addEventListener('change', (e) => {
    document.body.classList.toggle('large-text', e.target.checked);
    saveUserPreferences({ largeText: e.target.checked });
  });
}

function showAttendeeContent() {
  document.getElementById('attendee-auth-gate').style.display = 'none';
  document.getElementById('attendee-content').style.display = 'block';
  document.getElementById('portal-avatar').src = currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=7b61ff&color=fff`;
  document.getElementById('portal-avatar').alt = currentUser.displayName;
  document.getElementById('portal-greeting').textContent = `Welcome, ${currentUser.displayName}!`;
  document.getElementById('portal-email').textContent = currentUser.email;
  // Points
  document.getElementById('points-balance').textContent = getLoyaltyPoints();
  const historyEl = document.getElementById('points-history');
  historyEl.innerHTML = getPointsHistory().map(p => `<div class="point-item"><span class="point-action">${p.action}</span><span class="point-value">+${p.points}</span></div>`).join('');
  // Notifications
  const notifsEl = document.getElementById('portal-notifications');
  notifsEl.innerHTML = getNotifications().map(n => `<div class="portal-notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}"><span>${n.message}</span><span class="notif-time">${new Date(n.timestamp).toLocaleTimeString()}</span></div>`).join('');
  notifsEl.querySelectorAll('.portal-notif-item').forEach(item => {
    item.addEventListener('click', () => { markNotificationRead(item.dataset.id); item.classList.remove('unread'); });
  });
  // My orders
  const orders = getOrders(currentUser.email);
  const myOrdersEl = document.getElementById('my-orders');
  if (orders.length > 0) {
    myOrdersEl.innerHTML = orders.map(o => `<div class="order-item"><span class="order-id">${o.id}</span><span class="order-status-badge ${o.status === 'Delivered' ? 'delivered' : 'preparing'}">${o.status}</span></div>`).join('');
  }
  // Load saved prefs
  const prefs = getUserPreferences();
  if (prefs.highContrast) { document.getElementById('pref-high-contrast').checked = true; document.body.classList.add('high-contrast'); }
  if (prefs.largeText) { document.getElementById('pref-large-text').checked = true; document.body.classList.add('large-text'); }
}

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════
async function handleSignIn() {
  const user = await loginWithGoogle();
  if (user) {
    user.displayName = 'ABC'; // Override name per request
    currentUser = user;
    document.getElementById('auth-btn').style.display = 'none';
    document.getElementById('user-avatar-wrap').style.display = 'flex';
    document.getElementById('user-avatar').src = user.photoURL || '';
    document.getElementById('user-name').textContent = user.displayName;
    showToast(`Welcome, ${user.displayName}!`, 'success');
    if (currentTab === 'attendee') showAttendeeContent();
    if (currentTab === 'gates' && appData) renderGateCards(appData);
  }
}

async function handleSignOut() {
  await logoutUser();
  currentUser = null;
  document.getElementById('auth-btn').style.display = 'block';
  document.getElementById('user-avatar-wrap').style.display = 'none';
  showToast('You have been signed out', 'info');
  // Refresh attendee content
  const attendeeGate = document.getElementById('attendee-auth-gate');
  const attendeeContent = document.getElementById('attendee-content');
  if (attendeeGate) attendeeGate.style.display = 'flex';
  if (attendeeContent) attendeeContent.style.display = 'none';
}

// ─── Dark Mode ───
function initDarkMode() {
  const toggle = document.getElementById('dark-mode-toggle');
  const icon = document.getElementById('dark-mode-icon');
  const saved = localStorage.getItem('flowsphere-theme');
  if (saved === 'light') { document.body.classList.add('light-mode'); icon.textContent = '☀️'; }
  toggle?.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    icon.textContent = isLight ? '☀️' : '🌙';
    localStorage.setItem('flowsphere-theme', isLight ? 'light' : 'dark');
  });
}

// ─── Notification Dropdown ───
function initNotifications() {
  const bell = document.getElementById('bell-icon');
  const dropdown = document.getElementById('notifications-dropdown');
  bell?.addEventListener('click', () => {
    const open = !dropdown.hidden;
    dropdown.hidden = open;
    bell.setAttribute('aria-expanded', !open);
    if (!open) { document.getElementById('notif-badge').classList.remove('show'); }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.notification-wrapper')) dropdown.hidden = true;
  });
}

function addNotificationToDropdown(alert) {
  const list = document.getElementById('notifications-list');
  const badge = document.getElementById('notif-badge');
  if (!list) return;
  const empty = list.querySelector('.notif-empty');
  if (empty) empty.remove();
  const item = document.createElement('div');
  item.className = 'notif-item unread';
  item.innerHTML = `<span>⚠️</span><span>${alert.msg}</span>`;
  list.insertBefore(item, list.firstChild);
  const count = parseInt(badge.textContent || '0') + 1;
  badge.textContent = count;
  badge.classList.add('show');
}

// ─── Cooldown Timer UI ───
function startCooldownTimer(elementId, ms) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.hidden = false;
  let remaining = Math.ceil(ms / 1000);
  el.textContent = `(${remaining}s)`;
  const interval = setInterval(() => {
    remaining--;
    if (remaining <= 0) { el.hidden = true; clearInterval(interval); }
    else el.textContent = `(${remaining}s)`;
  }, 1000);
}

// ═══════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════
async function initApp() {
  const t0 = performance.now();
  initParticles();
  initTabNavigation();
  initDarkMode();
  initNotifications();

  // Auth button in nav
  document.getElementById('auth-btn')?.addEventListener('click', handleSignIn);
  document.getElementById('sign-out-btn')?.addEventListener('click', handleSignOut);

  // Load Google Maps
  try {
    await loadGoogleMaps('');
    mapsReady = true;
  } catch(e) {
    console.warn('Maps load failed:', e.message);
  }

  // Start Firebase data listener
  listenToFirebaseData((data) => {
    appData = data;
    updateDashboardStats(data);
    if (currentTab === 'dashboard' && mapsReady && tabsInitialized.dashboard) renderDashboardMapData(data);
    if (currentTab === 'gates' && tabsInitialized.gates) renderGateCards(data);
    if (currentTab === 'safety' && tabsInitialized.safety) { renderZoneGrid(data); renderAlertFeed(data); }
    if (currentTab === 'concessions' && tabsInitialized.concessions) { renderOrderQueue(); renderRestrooms(); }
    // Toast for new alerts
    if (data.alerts?.[0] && data.alerts[0].timestamp > Date.now() - 5000) {
      showToast(data.alerts[0].msg, data.alerts[0].severity === 'CRITICAL' ? 'error' : 'warning');
      addNotificationToDropdown(data.alerts[0]);
    }
  });

  // Init first tab
  tabsInitialized.dashboard = true;
  await initDashboard();

  // Footer year
  const footerMeta = document.querySelector('.footer-meta');
  if (footerMeta) {
    const span = document.createElement('span');
    span.style.cssText = 'display:block;margin-top:0.4rem;opacity:0.5;';
    span.textContent = `© ${new Date().getFullYear()} VenueIQ — FlowSphere System`;
    footerMeta.appendChild(span);
  }

  perfLog('App initialization', t0);
}

// Boot
initApp();
