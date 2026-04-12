/**
 * FlowSphere — UI Components (Enhanced)
 */
import { getWaitTimeCategory } from '../utils/calculations.js';
import { loginWithGoogle, listenToAuthStatus } from '../services/firebase.js';
import { sanitizeHTML } from '../utils/security.js';

export const renderWaitTimeBoard = (elementId, data) => {
  const container = document.getElementById(elementId);
  if (!container || !data || !data.waitTimes) return;

  let html = `
    <table class="wait-time-table" aria-label="Current gate and facility wait times">
      <thead>
        <tr><th scope="col">Location</th><th scope="col">Wait Time</th><th scope="col">Status</th></tr>
      </thead>
      <tbody aria-live="polite">
  `;

  for (const [location, timeData] of Object.entries(data.waitTimes)) {
    const time = typeof timeData === 'object' ? timeData.wait : timeData;
    const category = getWaitTimeCategory(time);
    html += `
      <tr>
        <td>${sanitizeHTML(location)}</td>
        <td>${time} min</td>
        <td><span class="status-indicator status-${category}" aria-label="Status ${category}"></span></td>
      </tr>
    `;
  }
  html += `</tbody></table>`;
  container.innerHTML = html;
};

const shownAlertIds = new Set();
let unreadCount = 0;

export const renderAlertBanner = (elementId, alertData) => {
  const container = document.getElementById(elementId);
  if (!container || !alertData) return;

  alertData.forEach(alert => {
    if (alert.active && !shownAlertIds.has(alert.id)) {
      shownAlertIds.add(alert.id);
      const toast = document.createElement('div');
      toast.className = `alert-banner alert-${alert.type || 'warning'}`;
      toast.setAttribute('role', 'alert');
      toast.setAttribute('aria-live', 'assertive');
      toast.innerHTML = `<span class="alert-icon">⚠️</span><span class="alert-msg">${sanitizeHTML(alert.msg)}</span>`;
      container.appendChild(toast);
      setTimeout(() => {
        if (container.contains(toast)) container.removeChild(toast);
      }, 6000);
    }
  });
};

export const initAuthUI = (buttonId, statusId) => {
  const btn = document.getElementById(buttonId);
  if (btn) {
    btn.addEventListener('click', async () => {
      const user = await loginWithGoogle();
      if (user) {
        // Auth handled by main app.js now
      }
    });
  }
};
