import { getWaitTimeCategory } from '../utils/calculations.js';
import { loginWithGoogle, listenToAuthStatus } from '../services/firebase.js';

export const renderWaitTimeBoard = (elementId, data) => {
  const container = document.getElementById(elementId);
  if (!container || !data || !data.waitTimes) return;

  // Render skeleton first? Well, if we have data we can render directly.
  let html = `
    <table class="wait-time-table" aria-label="Current gate and facility wait times">
      <thead>
        <tr>
          <th scope="col">Location</th>
          <th scope="col">Wait Time</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody aria-live="polite">
  `;

  for (const [location, time] of Object.entries(data.waitTimes)) {
    const category = getWaitTimeCategory(time);
    html += `
      <tr>
        <td>${location}</td>
        <td>${time} min</td>
        <td>
          <span class="status-indicator status-${category}" aria-label="Status ${category}"></span>
        </td>
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
    if(alert.active && !shownAlertIds.has(alert.id)) {
       shownAlertIds.add(alert.id);
       
       // Create a toast
       const toast = document.createElement('div');
       toast.className = `alert-banner alert-${alert.type}`;
       toast.setAttribute('role', 'alert');
       toast.setAttribute('aria-live', 'assertive');
       toast.innerHTML = `
         <span class="alert-icon">⚠️</span>
         <span class="alert-msg">${alert.msg}</span>
       `;
       container.appendChild(toast);

       // Remove from screen after 6 seconds
       setTimeout(() => {
         if (container.contains(toast)) {
            container.removeChild(toast);
         }
         addAlertToDropdown(alert);
       }, 6000);
    }
  });

  // Also setup bell toggle once if needed (can be put in a general init, but here works too if guarded)
  const bell = document.getElementById('bell-icon');
  const dropdown = document.getElementById('notifications-dropdown');
  if(bell && dropdown && !bell.hasAttribute('data-initialized')) {
    bell.setAttribute('data-initialized', 'true');
    bell.addEventListener('click', () => {
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
      const badge = document.getElementById('notif-badge');
      if (dropdown.style.display === 'block' && badge) {
         unreadCount = 0;
         badge.style.display = 'none';
         badge.innerText = '0';
      }
    });
  }
};

const addAlertToDropdown = (alert) => {
  const list = document.getElementById('notifications-list');
  const badge = document.getElementById('notif-badge');
  if(!list) return;
  
  if (shownAlertIds.size === 1) {
    list.innerHTML = ''; // Clear "No new notifications"
  }
  
  const item = document.createElement('div');
  item.style.padding = '10px';
  item.style.borderBottom = '1px solid var(--border-subtle)';
  item.style.fontSize = '0.9rem';
  item.style.color = '#fff';
  item.innerHTML = `<span style="margin-right: 8px;">⚠️</span>${alert.msg}`;
  
  list.insertBefore(item, list.firstChild);
  
  unreadCount++;
  if(badge) {
    badge.innerText = unreadCount;
    badge.style.display = 'block';
  }
};

export const initAuthUI = (buttonId, statusId) => {
  const btn = document.getElementById(buttonId);
  const statusMenu = document.getElementById(statusId);
  
  if(btn) {
    btn.addEventListener('click', async () => {
      const user = await loginWithGoogle();
      if(user) {
        window.location.href = 'dashboard.html';
      }
    });
  }

  listenToAuthStatus((user) => {
    if (user && statusMenu) {
      statusMenu.innerHTML = `<span class="auth-welcome">Welcome, ${user.displayName}</span>`;
      if(btn) btn.style.display = 'none';
    } else {
      if(statusMenu) statusMenu.innerHTML = '';
      if(btn) btn.style.display = 'block';
    }
  });
};
