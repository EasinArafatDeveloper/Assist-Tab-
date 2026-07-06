// Mock chrome.storage if running outside of extension context (e.g. for testing in web browser)
if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
  window.chrome = window.chrome || {};
  chrome.storage = {
    local: {
      get: (keys, callback) => {
        const result = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach(key => {
          result[key] = localStorage.getItem(key);
        });
        setTimeout(() => callback(result), 0);
      },
      set: (data, callback) => {
        Object.keys(data).forEach(key => {
          localStorage.setItem(key, data[key]);
        });
        if (callback) setTimeout(callback, 0);
      },
      remove: (keys, callback) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach(key => {
          localStorage.removeItem(key);
        });
        if (callback) setTimeout(callback, 0);
      }
    }
  };
}

// Global Application State
let TOKEN = null;
let BACKEND_URL = 'http://localhost:3000';
let USER = null;
let calendarEvents = {};
let CHAT_HISTORY = [
  { role: 'assistant', content: "Hello! I'm your Personal Assistant. I have access to your daily routine checklist and priority tasks. How can I help you organize your day today?" }
];

// Premium Dialog & Toast Helpers (Custom Hot Toast style)
const Alert = {
  createToastContainer: () => {
    let container = document.getElementById('custom-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'custom-toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  },

  showToast: (title, text, type) => {
    const container = Alert.createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    
    let iconHtml = '✨';
    if (type === 'success') iconHtml = '✓';
    else if (type === 'error') iconHtml = '✕';
    else if (type === 'info') iconHtml = 'ℹ';
    
    toast.innerHTML = `
      <div class="toast-icon ${type}">${iconHtml}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-text">${text}</div>
      </div>
    `;
    
    container.appendChild(toast);
    
    // Trigger transition
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // Auto remove after 3.2s
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 400);
    }, 3200);
  },

  success: (title, text) => {
    Alert.showToast(title || 'Success', text || '', 'success');
  },

  error: (title, text) => {
    Alert.showToast(title || 'Error', text || 'Something went wrong.', 'error');
  },

  info: (title, text) => {
    Alert.showToast(title || 'Info', text || '', 'info');
  },

  confirmDelete: (title, text) => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      
      overlay.innerHTML = `
        <div class="confirm-card">
          <div class="confirm-icon">⚠️</div>
          <div class="confirm-title">${title || 'Are you sure?'}</div>
          <div class="confirm-text">${text || 'This action cannot be undone.'}</div>
          <div class="confirm-actions">
            <button class="confirm-btn-cancel" id="confirm-cancel-btn">Cancel</button>
            <button class="confirm-btn-danger" id="confirm-yes-btn">Delete</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(overlay);
      
      // Trigger animations
      setTimeout(() => overlay.classList.add('show'), 10);
      
      const cleanUp = (value) => {
        overlay.classList.remove('show');
        setTimeout(() => {
          overlay.remove();
          resolve(value);
        }, 300);
      };
      
      overlay.querySelector('#confirm-cancel-btn').onclick = () => cleanUp(false);
      overlay.querySelector('#confirm-yes-btn').onclick = () => cleanUp(true);
      
      // Outside click closes as cancel
      overlay.onclick = (e) => {
        if (e.target === overlay) cleanUp(false);
      };
    });
  }
};

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const backendUrlConfig = document.getElementById('backend-url-config');

const welcomeMessage = document.getElementById('welcome-message');
const liveDate = document.getElementById('live-date');
const liveClock = document.getElementById('live-clock');

// Profile dropdown selectors
const profileTriggerBtn = document.getElementById('profile-trigger-btn');
const profileMenuCard = document.getElementById('profile-menu-card');
const profileMenuCloseBtn = document.getElementById('profile-menu-close-btn');
const profileLogoutBtn = document.getElementById('profile-logout-btn');
const profileMenuEmail = document.getElementById('profile-menu-email');
const profileMenuGreeting = document.getElementById('profile-menu-greeting');
const profileAvatarInitial = document.getElementById('profile-avatar-initial');
const profileMenuAvatarInitialLg = document.getElementById('profile-menu-avatar-initial-lg');

// Workspace Apps selectors
const DEFAULT_QUICK_LINKS = [
  { name: 'Gmail',     url: 'https://mail.google.com' },
  { name: 'Notion',   url: 'https://www.notion.so' },
  { name: 'Drive',    url: 'https://drive.google.com' },
  { name: 'GitHub',   url: 'https://github.com' },
  { name: 'YouTube',  url: 'https://www.youtube.com' },
  { name: 'ChatGPT',  url: 'https://chat.openai.com' },
  { name: 'Canva',    url: 'https://www.canva.com' },
  { name: 'Facebook', url: 'https://www.facebook.com' },
  { name: 'Instagram',url: 'https://www.instagram.com' },
];

let quickLinks = [];
const toolsContainer      = document.getElementById('tools-container');
const addLinkBtn          = document.getElementById('add-link-btn');
const addLinkModal        = document.getElementById('add-link-modal');
const addLinkModalClose   = document.getElementById('add-link-modal-close');
const addLinkForm         = document.getElementById('add-link-form');
const linkNameInput       = document.getElementById('link-name-input');
const linkUrlInput        = document.getElementById('link-url-input');

// View switching and Google Calendar selectors
const viewDashboardBtn = document.getElementById('view-dashboard-btn');
const viewCalendarBtn = document.getElementById('view-calendar-btn');
const mainDashboardView = document.getElementById('main-dashboard-view');
const calendarViewWrapper = document.getElementById('calendar-view-wrapper');

const calPrevMonthBtn = document.getElementById('cal-prev-month-btn');
const calNextMonthBtn = document.getElementById('cal-next-month-btn');
const calTodayBtn = document.getElementById('cal-today-btn');
const calMonthTitle = document.getElementById('cal-month-title');
const calendarDaysGrid = document.getElementById('calendar-days-grid');

const calendarEventModal = document.getElementById('calendar-event-modal');
const calModalDateTitle = document.getElementById('cal-modal-date-title');
const calModalCloseBtn = document.getElementById('cal-modal-close-btn');

const calEventForm = document.getElementById('cal-event-form');
const calEventTime = document.getElementById('cal-event-time');
const calEventPriority = document.getElementById('cal-event-priority');
const calEventDesc = document.getElementById('cal-event-desc');
const calEventsList = document.getElementById('cal-events-list');


const addRoutineToggle = document.getElementById('add-routine-toggle');
const routineFormContainer = document.getElementById('routine-form-container');
const routineForm = document.getElementById('routine-form');
const routineTitle = document.getElementById('routine-title');
const routineDesc = document.getElementById('routine-desc');
const routineTime = document.getElementById('routine-time');
const routineList = document.getElementById('routine-list');
const importRoutineToggle = document.getElementById('import-routine-toggle');
const importRoutineContainer = document.getElementById('import-routine-container');
const importTabFile = document.getElementById('import-tab-file');
const importTabSheet = document.getElementById('import-tab-sheet');
const importPaneFile = document.getElementById('import-pane-file');
const importPaneSheet = document.getElementById('import-pane-sheet');
const routineFileInput = document.getElementById('routine-file-input');
const fileUploadStatus = document.getElementById('file-upload-status');
const sheetUrlInput = document.getElementById('sheet-url-input');
const processImportBtn = document.getElementById('process-import-btn');

const priorityList = document.getElementById('priority-list');

const editRoutinePanel = document.getElementById('edit-routine-panel');
const editRoutineCloseBtn = document.getElementById('edit-routine-close-btn');
const editRoutineForm = document.getElementById('edit-routine-form');
const editRoutineId = document.getElementById('edit-routine-id');
const editRoutineTitle = document.getElementById('edit-routine-title');
const editRoutineDesc = document.getElementById('edit-routine-desc');
const editRoutineTime = document.getElementById('edit-routine-time');
const editRoutinePriority = document.getElementById('edit-routine-priority');

const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const searchSuggestions = document.getElementById('search-suggestions');

// Search Engine / AI Model Selector State & Elements
let SELECTED_ENGINE = 'google';
const engineSelectBtn = document.getElementById('engine-select-btn');
const selectedEngineIcon = document.getElementById('selected-engine-icon');
const selectedEngineName = document.getElementById('selected-engine-name');
const engineDropdownList = document.getElementById('engine-dropdown-list');
const engineOptionBtns = document.querySelectorAll('.engine-option-btn');



// time tracking elements
const trackerList = document.getElementById('tracker-list');
let TIME_STATS = {};

// AI assistant sidebar elements
const aiAssistantToggle = document.getElementById('ai-assistant-toggle');
const aiAssistantSidebar = document.getElementById('ai-assistant-sidebar');
const aiSidebarCloseBtn = document.getElementById('ai-sidebar-close-btn');
const aiSidebarMessages = document.getElementById('ai-sidebar-messages');
const aiSidebarForm = document.getElementById('ai-sidebar-form');
const aiSidebarInput = document.getElementById('ai-sidebar-input');
const aiSidebarStatus = document.getElementById('ai-sidebar-status');
const aiSidebarAttachBtn = document.getElementById('ai-sidebar-attach-btn');
const aiSidebarFileInput = document.getElementById('ai-sidebar-file-input');
const aiSidebarAttachmentPreview = document.getElementById('ai-sidebar-attachment-preview');

let AI_PROVIDER = 'deepseek';
let DEEPSEEK_KEY = null;
let GEMINI_KEY = null;
let OPENAI_KEY = null;
let CLAUDE_KEY = null;
let selectedFiles = []; // Array of { name, type, data } where data is base64 string

let AI_CHAT_HISTORY = [
  { role: 'assistant', content: "Hello! I'm your Personal Assistant. I can track your website usage, schedule routine tasks, and help manage your day.\n\nTry saying: <strong>\"Add task Study Chemistry at 5:00 PM with High priority\"</strong>" }
];

// 1. INITIALIZATION & AUTHENTICATION FLOW

document.addEventListener('DOMContentLoaded', async () => {
  // Check if page was opened via Focus Mode blocked page redirect
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('blocked') === '1') {
    const site = urlParams.get('site') || 'distracting website';
    const overlay = document.getElementById('focus-blocked-overlay');
    const siteNameEl = document.getElementById('focus-blocked-site-name');
    if (overlay && siteNameEl) {
      siteNameEl.textContent = site;
      overlay.classList.remove('hidden');
      const appContainer = document.querySelector('.app-container');
      if (appContainer) {
        appContainer.style.display = 'none';
      }
    }
  }

  // Load configuration from local storage
  chrome.storage.local.get([
    'jwt_token', 'backend_url', 'deepseek_key', 'gemini_key', 'openai_key', 'claude_key', 'ai_provider', 'theme', 'calendar_events'
  ], async (result) => {
    // Load calendar events
    calendarEvents = result.calendar_events || {};

    // Apply theme immediately
    const theme = result.theme || 'dark';
    document.body.setAttribute('data-theme', theme);

    if (result.backend_url) {
      BACKEND_URL = result.backend_url;
      if (backendUrlConfig) {
        backendUrlConfig.value = BACKEND_URL;
      }
    }
    
    if (result.ai_provider) {
      AI_PROVIDER = result.ai_provider;
    }

    if (result.deepseek_key) DEEPSEEK_KEY = result.deepseek_key;
    if (result.gemini_key) GEMINI_KEY = result.gemini_key;
    if (result.openai_key) OPENAI_KEY = result.openai_key;
    if (result.claude_key) CLAUDE_KEY = result.claude_key;
    
    if (result.jwt_token) {
      TOKEN = result.jwt_token;
      const verified = await verifyToken();
      if (verified) {
        initDashboard();
      } else {
        showAuthScreen();
      }
    } else {
      showAuthScreen();
    }
  });

  // Start Date & Time Live Clock
  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Profile menu card trigger toggle click
  if (profileTriggerBtn) {
    profileTriggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenuCard.classList.toggle('hidden');
    });
  }

  // Profile menu card close button click
  if (profileMenuCloseBtn) {
    profileMenuCloseBtn.addEventListener('click', () => {
      profileMenuCard.classList.add('hidden');
    });
  }

  // Sign out action inside profile card
  if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener('click', async () => {
      const confirmed = await Alert.confirmDelete('Sign Out', 'Are you sure you want to sign out?');
      if (confirmed) {
        TOKEN = null;
        USER = null;
        chrome.storage.local.remove('jwt_token', () => {
          if (typeof chrome !== 'undefined' && chrome.alarms) {
            chrome.alarms.clearAll();
          }
          profileMenuCard.classList.add('hidden');
          showAuthScreen();
        });
      }
    });
  }

  // Click outside to dismiss the profile card
  document.addEventListener('click', (e) => {
    if (profileMenuCard && !profileMenuCard.classList.contains('hidden')) {
      const isInside = profileMenuCard.contains(e.target);
      const isTrigger = profileTriggerBtn && profileTriggerBtn.contains(e.target);
      if (!isInside && !isTrigger) {
        profileMenuCard.classList.add('hidden');
      }
    }
  });
});

// Update the Date and Clock
function updateDateTime() {
  const now = new Date();
  
  // Format: "Friday, July 3, 2026"
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  liveDate.textContent = now.toLocaleDateString('en-US', dateOptions);
  
  // Format: "18:00:25" or "18:00"
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  liveClock.textContent = `${hours}:${minutes}`;

  // No class live status check needed
}

// Check JWT with backend /api/auth/me
async function verifyToken() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });

    if (res.ok) {
      const payload = await res.json();
      if (payload.success) {
        USER = payload.data.user;
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error('Failed to verify token:', err);
    return false;
  }
}

function showAuthScreen() {
  authScreen.classList.remove('hidden');
  dashboardScreen.classList.add('hidden');
}

function initDashboard() {
  authScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');
  
  // Personalized welcome
  const emailUsername = USER.email.split('@')[0];
  const capitalizedUser = emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1);
  welcomeMessage.textContent = `Hello, ${capitalizedUser}!`;

  // Populate Google-style profile menu card details
  const initialLetter = capitalizedUser.charAt(0).toUpperCase();
  if (profileAvatarInitial) profileAvatarInitial.textContent = initialLetter;
  if (profileMenuAvatarInitialLg) profileMenuAvatarInitialLg.textContent = initialLetter;
  if (profileMenuEmail) profileMenuEmail.textContent = USER.email;
  if (profileMenuGreeting) profileMenuGreeting.textContent = `Hi, ${capitalizedUser}!`;

  // Dynamically load Google Chrome Account details if available
  if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getProfileUserInfo) {
    chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
      if (userInfo && userInfo.email) {
        if (profileMenuEmail) profileMenuEmail.textContent = userInfo.email;
        const gUsername = userInfo.email.split('@')[0];
        const capGUser = gUsername.charAt(0).toUpperCase() + gUsername.slice(1);
        if (profileMenuGreeting) profileMenuGreeting.textContent = `Hi, ${capGUser}!`;
        
        // Update initials fallback
        const gInitial = capGUser.charAt(0).toUpperCase();
        if (profileAvatarInitial) profileAvatarInitial.textContent = gInitial;
        if (profileMenuAvatarInitialLg) profileMenuAvatarInitialLg.textContent = gInitial;

        if (userInfo.id) {
          // Construct Google profile photo url using Gaia ID
          const photoUrl = `https://lh3.googleusercontent.com/a/${userInfo.id}=s96-c`;
          const avatarImg = document.getElementById('profile-avatar-img');
          const avatarImgLg = document.getElementById('profile-menu-avatar-img-lg');
          
          if (avatarImg && avatarImgLg) {
            avatarImg.src = photoUrl;
            avatarImgLg.src = photoUrl;
            
            // Wait for image to load to verify it exists and is not broken
            avatarImg.onload = () => {
              avatarImg.classList.remove('hidden');
              if (profileAvatarInitial) profileAvatarInitial.style.display = 'none';
            };
            avatarImgLg.onload = () => {
              avatarImgLg.classList.remove('hidden');
              if (profileMenuAvatarInitialLg) profileMenuAvatarInitialLg.style.display = 'none';
            };

            // Handle errors (fallback to initials if image doesn't load)
            avatarImg.onerror = () => {
              avatarImg.classList.add('hidden');
              if (profileAvatarInitial) profileAvatarInitial.style.display = '';
            };
            avatarImgLg.onerror = () => {
              avatarImgLg.classList.add('hidden');
              if (profileMenuAvatarInitialLg) profileMenuAvatarInitialLg.style.display = '';
            };
          }
        }
      }
    });
  }

  // Fetch Dashboard Content
  fetchRoutines();
  fetchBookmarks();
  fetchTimeTrackerStats();
  checkGmailEmails();
  loadQuickLinks();
  syncTodayCalendarEventsToRoutines();
}

async function syncTodayCalendarEventsToRoutines() {
  if (!TOKEN) return;
  
  const today = new Date();
  const year = today.getFullYear();
  const formatM = String(today.getMonth() + 1).padStart(2, '0');
  const formatD = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${formatM}-${formatD}`;
  
  const todayEvents = calendarEvents[todayStr] || [];
  if (todayEvents.length === 0) return;
  
  chrome.storage.local.get(['synced_calendar_event_ids'], async (result) => {
    let syncedIds = result.synced_calendar_event_ids || [];
    
    // Find events for today that are not in syncedIds
    const unsyncedEvents = todayEvents.filter(evt => !syncedIds.includes(evt.id));
    
    if (unsyncedEvents.length > 0) {
      let newlySynced = [];
      let successCount = 0;
      
      for (const evt of unsyncedEvents) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/routine`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({
              title: evt.desc,
              description: 'Auto-synced from Calendar schedule',
              time: evt.time || '',
              priority: evt.priority || 'normal'
            })
          });
          
          if (res.ok) {
            newlySynced.push(evt.id);
            successCount++;
          }
        } catch (err) {
          console.error('Failed to sync calendar event to routine:', err);
        }
      }
      
      if (newlySynced.length > 0) {
        syncedIds = [...syncedIds, ...newlySynced];
        chrome.storage.local.set({ synced_calendar_event_ids: syncedIds }, () => {
          console.log(`Synced ${successCount} calendar events to daily routines.`);
          fetchRoutines();
        });
      }
    }
  });
}

// Auth Tab Switching (Login vs Register)
let authMode = 'login';

tabLogin.addEventListener('click', () => {
  authMode = 'login';
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  authSubmitBtn.textContent = 'Log In';
});

tabRegister.addEventListener('click', () => {
  authMode = 'register';
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  authSubmitBtn.textContent = 'Register Account';
});

// Submit login/registration
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = authEmail.value.trim();
  const password = authPassword.value;
  
  // Dynamic backend URL update if user edited connection setting before auth
  if (backendUrlConfig.value.trim()) {
    BACKEND_URL = backendUrlConfig.value.trim();
    chrome.storage.local.set({ backend_url: BACKEND_URL });
  }

  const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
  authSubmitBtn.disabled = true;
  authSubmitBtn.textContent = authMode === 'login' ? 'Logging in...' : 'Registering...';

  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      TOKEN = data.data.token;
      USER = data.data.user;
      
      // Save credentials locally
      chrome.storage.local.set({ jwt_token: TOKEN }, () => {
        authEmail.value = '';
        authPassword.value = '';
        authSubmitBtn.disabled = false;
        initDashboard();
      });
    } else {
      Alert.error('Auth Failed', data.error || 'Authentication failed. Please check your credentials.');
      authSubmitBtn.disabled = false;
      authSubmitBtn.textContent = authMode === 'login' ? 'Log In' : 'Register Account';
    }
  } catch (err) {
    console.error(err);
    Alert.error('Connection Error', 'Could not connect to the backend server. Make sure it is running.');
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = authMode === 'login' ? 'Log In' : 'Register Account';
  }
});

// Logout
function logout() {
  TOKEN = null;
  USER = null;
  chrome.storage.local.remove('jwt_token', () => {
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.clearAll();
    }
    showAuthScreen();
  });
}



// 3. DAILY ROUTINE MODULE

addRoutineToggle.addEventListener('click', () => {
  routineFormContainer.classList.toggle('hidden');
  routineTitle.focus();
});

// Fetch Routines
async function fetchRoutines() {
  try {
    // Send browser timezone offset in minutes to handle server-side calendar-day resets
    const offset = new Date().getTimezoneOffset();
    const res = await fetch(`${BACKEND_URL}/api/routine?offset=${offset}`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        renderRoutines(data.data);
        renderWorkPriority(data.data);
      }
    }
  } catch (err) {
    console.error('Fetch routines failed:', err);
    routineList.innerHTML = '<div class="loading-placeholder" style="color: var(--danger)">Connection to server lost.</div>';
  }
}

// Render Routines
function renderRoutines(routines) {
  if (routines.length === 0) {
    routineList.innerHTML = '<div class="loading-placeholder">No routine items yet. Click "+" to add one!</div>';
    return;
  }

  routineList.innerHTML = '';
  
  // Sort: incomplete first, then completed. Or maintain order.
  // Let's sort completed items to the bottom of the list for a clean productivity experience
  const sortedRoutines = [...routines].sort((a, b) => {
    if (a.isCompleted === b.isCompleted) {
      return a.order - b.order;
    }
    return a.isCompleted ? 1 : -1;
  });

  sortedRoutines.forEach(routine => {
    const item = document.createElement('div');
    item.className = `routine-item priority-${routine.priority || 'normal'} ${routine.isCompleted ? 'completed' : ''}`;
    item.dataset.id = routine._id;

    const timeBadge = routine.time ? `<span class="routine-time-badge">${routine.time}</span>` : '';
    const priorityLabelMap = {
      emergency: '🚨 Emergency',
      important: '⚠️ Important',
      normal: '📅 Normal'
    };
    const priorityBadge = `<span class="priority-badge ${routine.priority || 'normal'}">${priorityLabelMap[routine.priority || 'normal']}</span>`;

    item.innerHTML = `
      <div class="checkbox-wrapper">
        <input type="checkbox" id="check-${routine._id}" ${routine.isCompleted ? 'checked' : ''}>
        <label for="check-${routine._id}" class="checkmark"></label>
      </div>
      <div class="routine-content">
        <div class="routine-title-container">
          <span class="routine-title">${escapeHTML(routine.title)}</span>
          <div class="routine-meta-row">
            ${priorityBadge}
            ${timeBadge}
          </div>
        </div>
        ${routine.description ? `<p class="routine-desc">${escapeHTML(routine.description)}</p>` : ''}
      </div>
      <div style="display: flex; gap: 8px; align-self: flex-start; margin-top: 2px;">
        <button class="edit-action-btn" title="Edit Routine">✏️</button>
        <button class="delete-action-btn" title="Delete Routine">🗑️</button>
      </div>
    `;

    // Hook Checkbox Change
    const checkbox = item.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', async (e) => {
      const isCompleted = e.target.checked;
      item.classList.toggle('completed', isCompleted);
      
      try {
        const res = await fetch(`${BACKEND_URL}/api/routine/${routine._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
          },
          body: JSON.stringify({ isCompleted })
        });
        
        if (res.ok) {
          // Re-fetch to apply visual sort
          fetchRoutines();
        } else {
          // Revert checkbox state on error
          checkbox.checked = !isCompleted;
          item.classList.toggle('completed', !isCompleted);
        }
      } catch (err) {
        console.error('Update routine failed:', err);
        checkbox.checked = !isCompleted;
        item.classList.toggle('completed', !isCompleted);
      }
    });

    // Hook Edit Button
    const editBtn = item.querySelector('.edit-action-btn');
    editBtn.addEventListener('click', () => {
      openEditModal(routine);
    });

    // Hook Delete Button
    const deleteBtn = item.querySelector('.delete-action-btn');
    deleteBtn.addEventListener('click', async () => {
      const confirmed = await Alert.confirmDelete('Delete Task', `Delete routine "${routine.title}"?`);
      if (confirmed) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/routine/${routine._id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${TOKEN}` }
          });
          if (res.ok) {
            fetchRoutines();
            Alert.success('Deleted', `"${routine.title}" has been deleted.`);
          }
        } catch (err) {
          console.error(err);
          Alert.error('Error', 'Could not delete routine.');
        }
      }
    });

    routineList.appendChild(item);
  });
}

// Add New Routine
routineForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const title = routineTitle.value.trim();
  const description = routineDesc.value.trim();
  const time = routineTime.value;
  const routinePriority = document.getElementById('routine-priority');
  const priority = routinePriority ? routinePriority.value : 'normal';

  if (!title) return;

  try {
    const res = await fetch(`${BACKEND_URL}/api/routine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({ title, description, time, priority })
    });

    if (res.ok) {
      // Clear and hide form
      routineTitle.value = '';
      routineDesc.value = '';
      routineTime.value = '';
      if (routinePriority) routinePriority.value = 'normal';
      routineFormContainer.classList.add('hidden');
      
      fetchRoutines();
    }
  } catch (err) {
    console.error('Create routine failed:', err);
  }
});


// 4. WORK PRIORITY MODULE

function renderWorkPriority(routines) {
  if (!priorityList) return;

  const incompleteRoutines = routines.filter(r => !r.isCompleted);

  if (incompleteRoutines.length === 0) {
    priorityList.innerHTML = '<div class="loading-placeholder">No active tasks. Add a routine to get started!</div>';
    return;
  }

  priorityList.innerHTML = '';

  // Group incomplete routines by priority
  const groups = {
    emergency: [],
    important: [],
    normal: []
  };

  incompleteRoutines.forEach(r => {
    const prio = r.priority || 'normal';
    if (groups[prio]) {
      groups[prio].push(r);
    } else {
      groups.normal.push(r);
    }
  });

  const displayOrder = [
    { key: 'emergency', title: '🚨 Emergency (1st)', class: 'emergency' },
    { key: 'important', title: '⚠️ Important (2nd)', class: 'important' },
    { key: 'normal', title: '📅 Normal (3rd)', class: 'normal' }
  ];

  displayOrder.forEach(groupInfo => {
    const items = groups[groupInfo.key];
    if (items && items.length > 0) {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'priority-group';
      
      const header = document.createElement('div');
      header.className = `priority-group-title ${groupInfo.class}`;
      header.innerHTML = `<span>${groupInfo.title}</span>`;
      groupDiv.appendChild(header);

      items.forEach(routine => {
        const item = document.createElement('div');
        item.className = 'routine-item';
        item.style.marginBottom = '8px';
        item.style.padding = '12px';
        item.dataset.id = routine._id;

        const timeBadge = routine.time ? `<span class="routine-time-badge">${routine.time}</span>` : '';

        item.innerHTML = `
          <div class="checkbox-wrapper">
            <input type="checkbox" id="prio-check-${routine._id}">
            <label for="prio-check-${routine._id}" class="checkmark"></label>
          </div>
          <div class="routine-content">
            <div class="routine-title-row">
              <span class="routine-title">${escapeHTML(routine.title)}</span>
              ${timeBadge}
            </div>
            ${routine.description ? `<p class="routine-desc" style="font-size: 12px; margin-top: 2px;">${escapeHTML(routine.description)}</p>` : ''}
          </div>
          <div style="display: flex; gap: 8px; align-self: flex-start; margin-top: 2px;">
            <button class="edit-action-btn" title="Edit Routine">✏️</button>
            <button class="delete-action-btn" title="Delete Routine">🗑️</button>
          </div>
        `;

        // Bind Checkbox
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', async (e) => {
          const isCompleted = e.target.checked;
          item.style.opacity = '0.5';
          try {
            const res = await fetch(`${BACKEND_URL}/api/routine/${routine._id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
              },
              body: JSON.stringify({ isCompleted })
            });
            if (res.ok) {
              fetchRoutines();
            } else {
              checkbox.checked = false;
              item.style.opacity = '1';
            }
          } catch (err) {
            console.error(err);
            checkbox.checked = false;
            item.style.opacity = '1';
          }
        });

        // Bind Edit
        const editBtn = item.querySelector('.edit-action-btn');
        editBtn.addEventListener('click', () => {
          openEditModal(routine);
        });

        // Bind Delete
        const deleteBtn = item.querySelector('.delete-action-btn');
        deleteBtn.addEventListener('click', async () => {
          const confirmed = await Alert.confirmDelete('Delete Task', `Delete routine "${routine.title}"?`);
          if (confirmed) {
            try {
              const res = await fetch(`${BACKEND_URL}/api/routine/${routine._id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${TOKEN}` }
              });
              if (res.ok) {
                fetchRoutines();
                Alert.success('Deleted', `"${routine.title}" has been deleted.`);
              }
            } catch (err) {
              console.error(err);
              Alert.error('Error', 'Could not delete routine.');
            }
          }
        });

        groupDiv.appendChild(item);
      });

      priorityList.appendChild(groupDiv);
    }
  });

  if (priorityList.children.length === 0) {
    priorityList.innerHTML = '<div class="loading-placeholder">No active tasks. Add a routine to get started!</div>';
  }
}


// 6. CLAUDE AI ASSISTANT CHAT

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const query = chatInput.value.trim();
  if (!query) return;

  let url = '';
  const encodedQuery = encodeURIComponent(query);
  
  switch (SELECTED_ENGINE) {
    case 'deepseek':
      url = `https://chat.deepseek.com/`;
      // Copy query to clipboard for convenience
      navigator.clipboard.writeText(query).catch(err => console.error("Clipboard copy failed:", err));
      break;
    case 'google':
      url = `https://www.google.com/search?q=${encodedQuery}`;
      break;
    case 'chatgpt':
      url = `https://chatgpt.com/?q=${encodedQuery}`;
      break;
    case 'gemini':
      url = `https://gemini.google.com/app?q=${encodedQuery}`;
      break;
    case 'claude':
      url = `https://claude.ai/new?q=${encodedQuery}`;
      break;
    case 'perplexity':
      url = `https://www.perplexity.ai/?q=${encodedQuery}`;
      break;
  }

  if (url) {
    window.open(url, '_blank');
  }
  chatInput.value = '';
});


// Helper: Escape HTML strings to avoid security issues
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 7. FILE IMPORT & SPEECH-TO-TEXT DICTATION SYSTEM

// Toggle Import Routine Form
if (importRoutineToggle) {
  importRoutineToggle.addEventListener('click', () => {
    importRoutineContainer.classList.toggle('hidden');
    // Hide standard add routine form if open
    routineFormContainer.classList.add('hidden');
  });
}

// Handle Import Tabs Switching (File vs Google Sheet)
let activeImportTab = 'file';

if (importTabFile && importTabSheet) {
  importTabFile.addEventListener('click', () => {
    activeImportTab = 'file';
    importTabFile.classList.add('active');
    importTabSheet.classList.remove('active');
    importPaneFile.classList.remove('hidden');
    importPaneSheet.classList.add('hidden');
  });

  importTabSheet.addEventListener('click', () => {
    activeImportTab = 'sheet';
    importTabSheet.classList.add('active');
    importTabFile.classList.remove('active');
    importPaneSheet.classList.remove('hidden');
    importPaneFile.classList.add('hidden');
  });
}

// Display selected file name
if (routineFileInput) {
  routineFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      fileUploadStatus.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      fileUploadStatus.classList.remove('hidden');
    } else {
      fileUploadStatus.classList.add('hidden');
    }
  });
}

// Handle Import Button click
if (processImportBtn) {
  processImportBtn.addEventListener('click', async () => {
    processImportBtn.disabled = true;
    processImportBtn.textContent = 'Analyzing and Importing...';
    fileUploadStatus.textContent = 'Processing document text...';
    fileUploadStatus.classList.remove('hidden');

    try {
      let payload = {};

      if (activeImportTab === 'sheet') {
        const url = sheetUrlInput.value.trim();
        if (!url) {
          Alert.error('Input Needed', 'Please enter a Google Sheets URL.');
          processImportBtn.disabled = false;
          processImportBtn.textContent = 'Analyze & Import Tasks';
          return;
        }
        payload = { sheetUrl: url };
      } else {
        const file = routineFileInput.files[0];
        if (!file) {
          Alert.error('Input Needed', 'Please select a file to import.');
          processImportBtn.disabled = false;
          processImportBtn.textContent = 'Analyze & Import Tasks';
          return;
        }

        // Read file contents as Base64
        const fileData = await readFileAsBase64(file);
        payload = {
          fileData,
          fileName: file.name,
          fileType: file.type
        };
      }

      // POST to backend API
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'X-AI-Provider': AI_PROVIDER
      };
      if (DEEPSEEK_KEY) headers['X-DeepSeek-Api-Key'] = DEEPSEEK_KEY;
      if (GEMINI_KEY) headers['X-Gemini-Api-Key'] = GEMINI_KEY;
      if (OPENAI_KEY) headers['X-OpenAI-Api-Key'] = OPENAI_KEY;
      if (CLAUDE_KEY) headers['X-Claude-Api-Key'] = CLAUDE_KEY;

      const res = await fetch(`${BACKEND_URL}/api/routine/import`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        Alert.success('Imported!', `Successfully imported ${data.data.length} routine items.`);
        importRoutineContainer.classList.add('hidden');
        sheetUrlInput.value = '';
        routineFileInput.value = '';
        fileUploadStatus.classList.add('hidden');
        // Refresh routine list
        fetchRoutines();
      } else {
        Alert.error('Import Failed', data.error || 'Failed to analyze routines. Check your DeepSeek API configuration.');
      }
    } catch (err) {
      console.error('Import routines error:', err);
      Alert.error('Connection Error', 'An error occurred during import. Make sure your local server is running.');
    } finally {
      processImportBtn.disabled = false;
      processImportBtn.textContent = 'Analyze & Import Tasks';
    }
  });
}

// Helper: Read File as Base64 string
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result;
      const base64 = btoa(
        new Uint8Array(arrayBuffer)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

// Voice Typing (Speech-to-Text) using Web Speech API
function setupVoiceTyping(button, input) {
  if (!button || !input) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    button.style.display = 'none'; // Speech recognition not supported
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US'; // Default is English, but Speech API handles accent/input

  let isListening = false;

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });

  recognition.onstart = () => {
    isListening = true;
    button.classList.add('recording');
    input.placeholder = 'Listening... Speak now';
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    input.value = (input.value ? input.value + ' ' : '') + transcript;
  };

  recognition.onend = () => {
    isListening = false;
    button.classList.remove('recording');
    input.placeholder = input.id === 'chat-input' ? 'Ask DeepSeek...' : 'Routine Title (e.g. Read a book)';
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    isListening = false;
    button.classList.remove('recording');
  };
}

// Edit Routine Modal Event Listeners
function openEditModal(routine) {
  if (!editRoutinePanel) return;
  editRoutineId.value = routine._id;
  editRoutineTitle.value = routine.title;
  editRoutineDesc.value = routine.description || '';
  editRoutineTime.value = routine.time || '';
  editRoutinePriority.value = routine.priority || 'normal';
  editRoutinePanel.classList.remove('hidden');
}

if (editRoutineCloseBtn) {
  editRoutineCloseBtn.addEventListener('click', () => {
    editRoutinePanel.classList.add('hidden');
  });
}

if (editRoutineForm) {
  editRoutineForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editRoutineId.value;
    const title = editRoutineTitle.value.trim();
    const description = editRoutineDesc.value.trim();
    const time = editRoutineTime.value;
    const priority = editRoutinePriority.value;

    if (!title || !id) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/routine/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({ title, description, time, priority })
      });

      if (res.ok) {
        editRoutinePanel.classList.add('hidden');
        fetchRoutines();
        Alert.success('Saved', 'Your routine changes have been saved.');
      } else {
        Alert.error('Error', 'Failed to save changes. Make sure server is running.');
      }
    } catch (err) {
      console.error(err);
      Alert.error('Error', 'An error occurred while saving changes.');
    }
  });
}

// Fetch Bookmarks Bar from Chrome API
function fetchBookmarks() {
  const container = document.getElementById('bookmarks-container');
  if (!container) return;

  if (typeof chrome === 'undefined' || !chrome.bookmarks) {
    console.warn('Bookmarks API is not available (not running as extension context). Using fallbacks.');
    // Mock bookmarks for previewing inside browser development
    const mockBookmarks = [
      { title: 'Google', url: 'https://google.com' },
      { title: 'GitHub', url: 'https://github.com' },
      { title: 'Stack Overflow', url: 'https://stackoverflow.com' },
      { title: 'Mongoose Docs', url: 'https://mongoosejs.com' }
    ];
    renderBookmarks(mockBookmarks);
    return;
  }

  // Chrome Bookmarks Bar folder has default ID "1"
  chrome.bookmarks.getSubTree("1", (results) => {
    if (results && results[0] && results[0].children) {
      // Filter out folders, keep only direct bookmark items
      const bookmarksList = results[0].children.filter(item => item.url);
      renderBookmarks(bookmarksList);
    } else {
      // Fallback: search for Bookmarks Bar by folder name
      chrome.bookmarks.search({ title: 'Bookmarks bar' }, (folders) => {
        if (folders.length > 0 && folders[0].id) {
          chrome.bookmarks.getSubTree(folders[0].id, (subResults) => {
            if (subResults && subResults[0] && subResults[0].children) {
              renderBookmarks(subResults[0].children.filter(item => item.url));
            } else {
              container.innerHTML = '<div class="loading-placeholder" style="padding: 0; font-size: 11px;">Bookmarks bar folder is empty.</div>';
            }
          });
        } else {
          // Fallback: get 12 most recent bookmarks
          chrome.bookmarks.getRecent(12, (recent) => {
            if (recent && recent.length > 0) {
              renderBookmarks(recent);
            } else {
              container.innerHTML = '<div class="loading-placeholder" style="padding: 0; font-size: 11px;">No bookmarks found.</div>';
            }
          });
        }
      });
    }
  });
}

// Render Bookmarks List
function renderBookmarks(bookmarks) {
  const container = document.getElementById('bookmarks-container');
  if (!container) return;

  if (!bookmarks || bookmarks.length === 0) {
    container.innerHTML = '<div class="loading-placeholder" style="padding: 0; font-size: 11px;">Bookmarks bar folder is empty.</div>';
    return;
  }

  // Clear previous observers to avoid memory leaks
  if (container._resizeObserver) {
    container._resizeObserver.disconnect();
  }

  container.innerHTML = '';

  // Create visible wrapper
  const visibleWrapper = document.createElement('div');
  visibleWrapper.className = 'bookmarks-visible-wrapper';
  container.appendChild(visibleWrapper);

  // Create overflow button
  const overflowBtn = document.createElement('button');
  overflowBtn.className = 'bookmarks-overflow-btn hidden';
  overflowBtn.innerHTML = '»';
  overflowBtn.title = 'Show remaining bookmarks';
  container.appendChild(overflowBtn);

  // Create dropdown menu
  const dropdownMenu = document.createElement('div');
  dropdownMenu.className = 'bookmarks-dropdown-menu hidden';
  container.appendChild(dropdownMenu);

  // Toggle dropdown on click
  overflowBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('hidden');
  });

  // Helper to create regular bookmark item
  function createBookmarkLink(b) {
    let hostname = '';
    try {
      hostname = new URL(b.url).hostname;
    } catch (e) {
      hostname = b.url;
    }
    const link = document.createElement('a');
    link.href = b.url;
    link.target = '_blank';
    link.className = 'bookmark-item';
    link.dataset.tooltip = `${b.title}\n(${hostname})`;
    const faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain=${hostname}`;
    link.innerHTML = `
      <img src="${faviconUrl}" class="bookmark-icon" alt="" onerror="this.src='icon-128.png'">
      <span class="bookmark-text">${escapeHTML(b.title)}</span>
    `;
    return link;
  }

  // Helper to create dropdown bookmark item
  function createBookmarkDropdownLink(b) {
    let hostname = '';
    try {
      hostname = new URL(b.url).hostname;
    } catch (e) {
      hostname = b.url;
    }
    const link = document.createElement('a');
    link.href = b.url;
    link.target = '_blank';
    link.className = 'bookmark-dropdown-item';
    const faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain=${hostname}`;
    link.innerHTML = `
      <img src="${faviconUrl}" class="bookmark-icon" alt="" onerror="this.src='icon-128.png'">
      <span class="bookmark-dropdown-text">${escapeHTML(b.title)}</span>
    `;
    return link;
  }

  // Function to adjust item locations based on width
  const adjustLayout = () => {
    const containerWidth = container.clientWidth;
    
    // If container is not yet visible or sized, render all bookmarks visible for standard baseline flow
    if (containerWidth <= 0) {
      visibleWrapper.innerHTML = '';
      bookmarks.forEach(b => {
        const link = createBookmarkLink(b);
        visibleWrapper.appendChild(link);
      });
      return;
    }

    // Temporarily append all items to visibleWrapper to measure their actual rendered widths
    visibleWrapper.innerHTML = '';
    const tempLinks = bookmarks.map(b => {
      const link = createBookmarkLink(b);
      visibleWrapper.appendChild(link);
      return link;
    });

    const itemWidths = tempLinks.map(link => link.getBoundingClientRect().width || link.offsetWidth || 100);

    const gap = 6;
    const totalCount = bookmarks.length;
    let totalNeeded = 0;
    for (let i = 0; i < totalCount; i++) {
      totalNeeded += itemWidths[i];
      if (i > 0) totalNeeded += gap;
    }

    if (totalNeeded <= containerWidth) {
      // All items fit perfectly in the visible bookmarks bar
      dropdownMenu.innerHTML = '';
      overflowBtn.classList.add('hidden');
      dropdownMenu.classList.add('hidden');
    } else {
      // Items exceed space, show remaining items in a dropdown
      // Leave approx 45px for the overflow button (» button width + margins)
      const maxVisibleWidth = containerWidth - 45;
      
      let currentWidth = 0;
      let fitCount = 0;
      for (let i = 0; i < totalCount; i++) {
        const needed = currentWidth + itemWidths[i] + (i > 0 ? gap : 0);
        if (needed <= maxVisibleWidth) {
          currentWidth = needed;
          fitCount++;
        } else {
          break;
        }
      }

      // Re-populate visible and dropdown wrappers based on calculated fits
      visibleWrapper.innerHTML = '';
      dropdownMenu.innerHTML = '';
      
      for (let i = 0; i < totalCount; i++) {
        if (i < fitCount) {
          visibleWrapper.appendChild(tempLinks[i]);
        } else {
          const dropdownLink = createBookmarkDropdownLink(bookmarks[i]);
          dropdownMenu.appendChild(dropdownLink);
        }
      }
      overflowBtn.classList.remove('hidden');
    }
  };

  // Observe parent size mutations dynamically
  const resizeObserver = new ResizeObserver(() => {
    adjustLayout();
  });
  const parentBar = document.querySelector('.bookmarks-bar-native');
  if (parentBar) {
    resizeObserver.observe(parentBar);
  }
  container._resizeObserver = resizeObserver;

  // Run initial calculations
  adjustLayout();
}

// Overlay clicks to close modals
window.addEventListener('click', (e) => {
  if (e.target === editRoutinePanel) {
    editRoutinePanel.classList.add('hidden');
  }

  // Close bookmarks dropdown on outside click
  const dropdownMenu = document.querySelector('.bookmarks-dropdown-menu');
  const overflowBtn = document.querySelector('.bookmarks-overflow-btn');
  if (dropdownMenu && !dropdownMenu.classList.contains('hidden')) {
    if (!dropdownMenu.contains(e.target) && e.target !== overflowBtn) {
      dropdownMenu.classList.add('hidden');
    }
  }

  // Close engine selector dropdown on outside click
  if (engineDropdownList && !engineDropdownList.classList.contains('hidden')) {
    if (!engineDropdownList.contains(e.target) && !engineSelectBtn.contains(e.target)) {
      engineDropdownList.classList.add('hidden');
    }
  }
});

// Toggle Engine Selector Dropdown
if (engineSelectBtn) {
  engineSelectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    engineDropdownList.classList.toggle('hidden');
  });
}

// Engine Selection Option clicks
engineOptionBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const engine = btn.dataset.engine;
    const name = btn.dataset.name;
    const icon = btn.dataset.icon;
    const placeholder = btn.dataset.placeholder;

    SELECTED_ENGINE = engine;
    selectedEngineIcon.src = icon;
    selectedEngineName.textContent = name;
    chatInput.placeholder = placeholder;

    // Remove active class from all options, add to selected
    engineOptionBtns.forEach(opt => opt.classList.remove('active'));
    btn.classList.add('active');

    // Close dropdown
    engineDropdownList.classList.add('hidden');
    
    // Focus input
    chatInput.focus();
  });
});

// Initialize Voice Dictation
document.addEventListener('DOMContentLoaded', () => {
  // Wait a small delay to make sure DOM elements are bound
  setTimeout(() => {
    setupVoiceTyping(document.getElementById('routine-mic-btn'), document.getElementById('routine-title'));
    setupVoiceTyping(document.getElementById('chat-mic-btn'), document.getElementById('chat-input'));
    setupVoiceTyping(document.getElementById('ai-sidebar-mic-btn'), document.getElementById('ai-sidebar-input'));
  }, 100);
});

// Floating AI Assistant Sidebar open/close toggle
if (aiAssistantToggle) {
  aiAssistantToggle.addEventListener('click', () => {
    aiAssistantSidebar.classList.toggle('closed');
    if (!aiAssistantSidebar.classList.contains('closed')) {
      aiSidebarInput.focus();
    }
  });
}

if (aiSidebarCloseBtn) {
  aiSidebarCloseBtn.addEventListener('click', () => {
    aiAssistantSidebar.classList.add('closed');
  });
}

// Close sidebar on pressing escape
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !aiAssistantSidebar.classList.contains('closed')) {
    aiAssistantSidebar.classList.add('closed');
  }
});

// Time Tracking logic constants & helper functions
const DISTRACTION_DOMAINS = [
  'facebook.com', 'instagram.com', 'youtube.com', 'x.com', 'twitter.com',
  'reddit.com', 'netflix.com', 'tiktok.com', 'linkedin.com', 'pinterest.com'
];

function formatSeconds(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return remainingMin > 0 ? `${hours}h ${remainingMin}m` : `${hours}h`;
}

function fetchTimeTrackerStats() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    const mockStats = {
      'google.com': 1250,
      'github.com': 2800,
      'facebook.com': 3600,
      'youtube.com': 1800,
      'stackoverflow.com': 900
    };
    renderTimeTracker(mockStats);
    return;
  }

  const localDate = new Date();
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const todayStr = `daily_usage_${year}-${month}-${day}`;

  chrome.storage.local.get([todayStr], (result) => {
    const stats = result[todayStr] || {};
    renderTimeTracker(stats);
  });
}

function renderTimeTracker(stats) {
  if (!trackerList) return;

  TIME_STATS = stats;

  // ── Date label ──
  const dateLabelEl = document.getElementById('tracker-date-label');
  if (dateLabelEl) {
    const now = new Date();
    dateLabelEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  const entries = Object.entries(stats);
  if (entries.length === 0) {
    trackerList.innerHTML = '<div class="loading-placeholder" style="padding: 12px 0;">No active website usage tracked today.</div>';
    drawDonutChart(0, 0);
    return;
  }

  entries.sort((a, b) => b[1] - a[1]);

  // ── Tally productive vs distraction seconds ──
  let productiveSec = 0, distractionSec = 0;
  entries.forEach(([domain, seconds]) => {
    if (DISTRACTION_DOMAINS.includes(domain.toLowerCase())) {
      distractionSec += seconds;
    } else {
      productiveSec += seconds;
    }
  });
  const totalSec = productiveSec + distractionSec;

  // ── Update stat chips ──
  const prodEl = document.getElementById('tracker-stat-productive');
  const distEl = document.getElementById('tracker-stat-distraction');
  const totEl  = document.getElementById('tracker-stat-total');
  if (prodEl) prodEl.textContent = formatSeconds(productiveSec);
  if (distEl) distEl.textContent = formatSeconds(distractionSec);
  if (totEl)  totEl.textContent  = formatSeconds(totalSec);

  // ── Draw donut chart ──
  const focusPct = totalSec > 0 ? Math.round((productiveSec / totalSec) * 100) : 0;
  drawDonutChart(productiveSec, distractionSec);

  const pctEl = document.getElementById('tracker-donut-pct');
  if (pctEl) pctEl.textContent = focusPct + '%';

  // ── Render site list ──
  const topEntries = entries.slice(0, 5);
  const maxTime = topEntries[0][1] || 1;

  trackerList.innerHTML = '';

  topEntries.forEach(([domain, seconds], idx) => {
    const isDistraction = DISTRACTION_DOMAINS.includes(domain.toLowerCase());
    const pct = Math.round((seconds / maxTime) * 100);
    const faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
    const rank = ['🥇','🥈','🥉','④','⑤'][idx] || `${idx+1}.`;

    const itemDiv = document.createElement('div');
    itemDiv.className = 'tracker-item';
    itemDiv.innerHTML = `
      <div class="tracker-item-header">
        <div class="tracker-site-info">
          <span style="font-size:13px;flex-shrink:0;">${rank}</span>
          <img src="${faviconUrl}" class="tracker-site-icon" alt="" onerror="this.src='icon-128.png'">
          <span class="tracker-site-name" title="${domain}">${domain}</span>
          <span class="tracker-badge ${isDistraction ? 'distraction' : 'productive'}">
            ${isDistraction ? '⚡ Distraction' : '✅ Productive'}
          </span>
        </div>
        <span class="tracker-time-text">${formatSeconds(seconds)}</span>
      </div>
      <div class="tracker-progress-container">
        <div class="tracker-progress-bar ${isDistraction ? 'distraction' : 'productive'}" style="width: ${pct}%;"></div>
      </div>
    `;
    trackerList.appendChild(itemDiv);
  });
}

/* ── Pure Canvas Donut Chart ── */
function drawDonutChart(productiveSec, distractionSec) {
  const canvas = document.getElementById('tracker-donut-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const radius = (W / 2) - 8;
  const lineW = 14;

  ctx.clearRect(0, 0, W, H);

  const total = productiveSec + distractionSec;

  if (total === 0) {
    // Empty state ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = lineW;
    ctx.stroke();
    return;
  }

  const prodAngle = (productiveSec / total) * Math.PI * 2;
  const distAngle = (distractionSec / total) * Math.PI * 2;
  const startAngle = -Math.PI / 2;

  // Background track
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = lineW;
  ctx.stroke();

  // Gap between segments (in radians)
  const gap = 0.04;

  // Productive arc
  if (productiveSec > 0) {
    const prodGrad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
    prodGrad.addColorStop(0, '#16a34a');
    prodGrad.addColorStop(1, '#4ade80');

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle + gap / 2, startAngle + prodAngle - gap / 2);
    ctx.strokeStyle = prodGrad;
    ctx.lineWidth = lineW;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(34,197,94,0.6)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Distraction arc
  if (distractionSec > 0) {
    const distGrad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
    distGrad.addColorStop(0, '#f43f5e');
    distGrad.addColorStop(1, '#fb7185');

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle + prodAngle + gap / 2, startAngle + prodAngle + distAngle - gap / 2);
    ctx.strokeStyle = distGrad;
    ctx.lineWidth = lineW;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(244,63,94,0.5)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

// Periodically refresh stats on newtab page
setInterval(() => {
  if (TOKEN) {
    fetchTimeTrackerStats();
  }
}, 10000);

// Append a message to the AI Assistant Sidebar Chat History
function appendSidebarChatMessage(role, content, files = []) {
  if (!aiSidebarMessages) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;

  let filesHtml = '';
  if (files && files.length > 0) {
    filesHtml = '<div class="msg-attachments" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">';
    files.forEach(file => {
      const isImage = file.type.startsWith('image/');
      if (isImage) {
        filesHtml += `<img src="${file.data}" style="max-width: 150px; max-height: 150px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); margin-top: 4px; display: block;" />`;
      } else {
        filesHtml += `<div style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 6px; font-size: 11px; display: flex; align-items: center; gap: 4px; border: 1px solid rgba(255,255,255,0.1);"><span style="font-size: 14px;">${getFileIcon(file.name)}</span><span>${file.name}</span></div>`;
      }
    });
    filesHtml += '</div>';
  }

  msgDiv.innerHTML = `<div class="msg-bubble">${content.replace(/\n/g, '<br>')}${filesHtml}</div>`;

  aiSidebarMessages.appendChild(msgDiv);
  aiSidebarMessages.scrollTop = aiSidebarMessages.scrollHeight;
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'pdf') return '📕';
  if (ext === 'xlsx' || ext === 'xls') return '📗';
  if (ext === 'csv') return '📊';
  if (ext === 'txt') return '📄';
  return '📎';
}

// Render attachment preview chips
function renderAttachmentPreviews() {
  if (!aiSidebarAttachmentPreview) return;

  if (selectedFiles.length === 0) {
    aiSidebarAttachmentPreview.innerHTML = '';
    aiSidebarAttachmentPreview.classList.add('hidden');
    return;
  }

  aiSidebarAttachmentPreview.innerHTML = '';
  aiSidebarAttachmentPreview.classList.remove('hidden');

  // Title / status label
  const titleDiv = document.createElement('div');
  titleDiv.className = 'preview-title';
  titleDiv.innerHTML = `📎 Ready to send (${selectedFiles.length}/3 files)`;
  aiSidebarAttachmentPreview.appendChild(titleDiv);

  // List container
  const listDiv = document.createElement('div');
  listDiv.className = 'preview-list';

  selectedFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'preview-item';

    const isImage = file.type.startsWith('image/');
    if (isImage) {
      const img = document.createElement('img');
      img.src = file.data;
      item.appendChild(img);
    } else {
      const icon = document.createElement('span');
      icon.className = 'file-icon';
      icon.textContent = getFileIcon(file.name);
      item.appendChild(icon);
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = file.name;
    item.appendChild(nameSpan);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', () => {
      selectedFiles.splice(index, 1);
      renderAttachmentPreviews();
    });
    item.appendChild(removeBtn);

    listDiv.appendChild(item);
  });

  aiSidebarAttachmentPreview.appendChild(listDiv);
}

// Shared selector function
function handleFilesSelected(files) {
  if (!files || !files.length) return;

  for (const file of files) {
    if (selectedFiles.length >= 3) {
      Alert.error('Upload Limit', 'You can upload up to 3 files at a time.');
      break;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      // Avoid duplicate file uploads if they select the exact same file content
      const alreadyAttached = selectedFiles.some(f => f.name === file.name && f.type === file.type);
      if (!alreadyAttached) {
        selectedFiles.push({
          name: file.name,
          type: file.type,
          data: event.target.result
        });
        renderAttachmentPreviews();
      }
    };
    reader.readAsDataURL(file);
  }
}

// Binds file input change & click events
if (aiSidebarAttachBtn && aiSidebarFileInput) {
  aiSidebarAttachBtn.addEventListener('click', () => {
    aiSidebarFileInput.click();
  });

  aiSidebarFileInput.addEventListener('change', (e) => {
    handleFilesSelected(e.target.files);
    aiSidebarFileInput.value = '';
  });
}

// Binds drag and drop events for AI sidebar
if (aiAssistantSidebar) {
  ['dragenter', 'dragover'].forEach(eventName => {
    aiAssistantSidebar.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      aiAssistantSidebar.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    aiAssistantSidebar.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      aiAssistantSidebar.classList.remove('drag-over');
    }, false);
  });

  aiAssistantSidebar.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      handleFilesSelected(files);
    }
  }, false);
}

// Binds clipboard paste events for AI sidebar input
if (aiSidebarInput) {
  aiSidebarInput.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const pastedFiles = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          pastedFiles.push(file);
        }
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault(); // Prevent pasting raw file paths/text if pasting a file
      handleFilesSelected(pastedFiles);
    }
  });
}

// Binds form submit for AI sidebar
if (aiSidebarForm) {
  aiSidebarForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const query = aiSidebarInput.value.trim();
    if (!query && selectedFiles.length === 0) return;

    // Show current user query and any attached files in chat
    appendSidebarChatMessage('user', query, selectedFiles);
    aiSidebarInput.value = '';

    // Push the current user query to chat history
    AI_CHAT_HISTORY.push({ role: 'user', content: query });

    if (aiSidebarStatus) {
      aiSidebarStatus.textContent = 'Agent Typing...';
      aiSidebarStatus.className = 'status-indicator typing';
    }

    const filesToSend = [...selectedFiles];
    
    // Clear attachment previews
    selectedFiles = [];
    renderAttachmentPreviews();

    try {
      const clientTime = new Date().toISOString();
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'X-AI-Provider': AI_PROVIDER
      };
      
      if (DEEPSEEK_KEY) headers['X-DeepSeek-Api-Key'] = DEEPSEEK_KEY;
      if (GEMINI_KEY) headers['X-Gemini-Api-Key'] = GEMINI_KEY;
      if (OPENAI_KEY) headers['X-OpenAI-Api-Key'] = OPENAI_KEY;
      if (CLAUDE_KEY) headers['X-Claude-Api-Key'] = CLAUDE_KEY;

      const res = await fetch(`${BACKEND_URL}/api/ask-ai?clientTime=${encodeURIComponent(clientTime)}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          messages: AI_CHAT_HISTORY,
          timeStats: TIME_STATS,
          files: filesToSend
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const rawReply = data.data.content;
          
          // Parse any command tags in the response
          const cleanedReply = await parseAgentCommands(rawReply);

          appendSidebarChatMessage('assistant', cleanedReply);
          AI_CHAT_HISTORY.push({ role: 'assistant', content: cleanedReply });
        } else {
          appendSidebarChatMessage('assistant', `Error: ${data.error || 'Unknown error occurred.'}`);
        }
      } else {
        appendSidebarChatMessage('assistant', "Could not reach assistant server. Check your connection or API key.");
      }
    } catch (err) {
      console.error('AI request failed:', err);
      appendSidebarChatMessage('assistant', "Connection error. Make sure your backend server is running.");
    } finally {
      if (aiSidebarStatus) {
        aiSidebarStatus.textContent = 'Agent Active';
        aiSidebarStatus.className = 'status-indicator online';
      }
    }
  });
}

// Helper to parse and execute AI tool-calling commands
async function parseAgentCommands(text) {
  let cleanedText = text;

  // Regexes for commands
  const addRegex = /\[ADD_ROUTINE:\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\]/;
  const completeRegex = /\[COMPLETE_ROUTINE:\s*(.*?)\s*\]/;
  const deleteRegex = /\[DELETE_ROUTINE:\s*(.*?)\s*\]/;

  // Parse ADD_ROUTINE
  let addMatch = cleanedText.match(addRegex);
  if (addMatch) {
    cleanedText = cleanedText.replace(addRegex, '').trim();
    const title = addMatch[1].trim();
    const description = addMatch[2].trim();
    const time = addMatch[3].trim();
    const priority = addMatch[4].trim().toLowerCase();

    try {
      const res = await fetch(`${BACKEND_URL}/api/routine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({ title, description, time, priority })
      });
      if (res.ok) {
        fetchRoutines();
        Alert.success('Routine Added', `"${title}" has been successfully scheduled!`);
      }
    } catch (err) {
      console.error('Failed to auto-add routine via AI agent:', err);
    }
  }

  // Parse COMPLETE_ROUTINE
  let completeMatch = cleanedText.match(completeRegex);
  if (completeMatch) {
    cleanedText = cleanedText.replace(completeRegex, '').trim();
    const title = completeMatch[1].trim();

    try {
      // Find routine ID by fetching current list
      const offset = new Date().getTimezoneOffset();
      const resList = await fetch(`${BACKEND_URL}/api/routine?offset=${offset}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      if (resList.ok) {
        const listData = await resList.json();
        const routines = listData.data || [];
        const routineToComplete = routines.find(r => r.title.toLowerCase() === title.toLowerCase());
        
        if (routineToComplete) {
          const resComplete = await fetch(`${BACKEND_URL}/api/routine/${routineToComplete._id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({ isCompleted: true })
          });
          if (resComplete.ok) {
            fetchRoutines();
            Alert.success('Routine Completed', `"${routineToComplete.title}" has been completed!`);
          }
        }
      }
    } catch (err) {
      console.error('Failed to complete routine via AI agent:', err);
    }
  }

  // Parse DELETE_ROUTINE
  let deleteMatch = cleanedText.match(deleteRegex);
  if (deleteMatch) {
    cleanedText = cleanedText.replace(deleteRegex, '').trim();
    const title = deleteMatch[1].trim();

    try {
      const offset = new Date().getTimezoneOffset();
      const resList = await fetch(`${BACKEND_URL}/api/routine?offset=${offset}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      if (resList.ok) {
        const listData = await resList.json();
        const routines = listData.data || [];
        const routineToDelete = routines.find(r => r.title.toLowerCase() === title.toLowerCase());
        
        if (routineToDelete) {
          const resDelete = await fetch(`${BACKEND_URL}/api/routine/${routineToDelete._id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${TOKEN}` }
          });
          if (resDelete.ok) {
            fetchRoutines();
            Alert.success('Routine Deleted', `"${routineToDelete.title}" deleted.`);
          }
        }
      }
    } catch (err) {
      console.error('Failed to delete routine via AI agent:', err);
    }
  }

  // Parse ADD_LINK
  const addLinkRegex = /\[ADD_LINK:\s*(.*?)\s*\|\s*(.*?)\s*\]/;
  let addLinkMatch = cleanedText.match(addLinkRegex);
  if (addLinkMatch) {
    cleanedText = cleanedText.replace(addLinkRegex, '').trim();
    const linkName = addLinkMatch[1].trim();
    const linkUrl  = addLinkMatch[2].trim();
    try {
      const ok = await addQuickLink(linkName, linkUrl);
      if (ok) {
        Alert.success('App Added', `"${linkName}" added to Workspace Apps!`);
      }
    } catch (err) {
      console.error('Failed to add link via AI agent:', err);
    }
  }

  // Parse REMOVE_LINK
  const removeLinkRegex = /\[REMOVE_LINK:\s*(.*?)\s*\]/;
  let removeLinkMatch = cleanedText.match(removeLinkRegex);
  if (removeLinkMatch) {
    cleanedText = cleanedText.replace(removeLinkRegex, '').trim();
    const linkUrl = removeLinkMatch[1].trim();
    try {
      const res = await fetch(`${BACKEND_URL}/api/links`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ url: linkUrl })
      });
      if (res.ok) {
        quickLinks = quickLinks.filter(l => l.url !== linkUrl);
        renderQuickLinks(quickLinks);
        Alert.success('App Removed', 'Workspace app removed.');
      }
    } catch (err) {
      console.error('Failed to remove link via AI agent:', err);
    }
  }

  return cleanedText;
}

// 7. GOOGLE SEARCH AUTOCOMPLETE SUGGESTIONS
let suggestionsDebounceTimeout;
let activeSuggestionIndex = -1;
let currentSuggestionsList = [];

function fetchGoogleSuggestions(query) {
  clearTimeout(suggestionsDebounceTimeout);
  if (!query) {
    hideSuggestions();
    return;
  }

  suggestionsDebounceTimeout = setTimeout(async () => {
    try {
      const response = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data[1])) {
          currentSuggestionsList = data[1].slice(0, 6);
          renderSuggestions(currentSuggestionsList);
        }
      }
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
    }
  }, 150);
}

function renderSuggestions(suggestions) {
  if (!searchSuggestions) return;
  
  if (suggestions.length === 0) {
    hideSuggestions();
    return;
  }

  searchSuggestions.innerHTML = '';
  activeSuggestionIndex = -1;

  suggestions.forEach((suggestion, idx) => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.innerHTML = `<span class="suggestion-icon">🔍</span><span>${escapeHTML(suggestion)}</span>`;
    
    item.addEventListener('click', () => {
      chatInput.value = suggestion;
      hideSuggestions();
      chatForm.dispatchEvent(new Event('submit'));
    });

    searchSuggestions.appendChild(item);
  });

  searchSuggestions.classList.remove('hidden');
}

function hideSuggestions() {
  if (searchSuggestions) {
    searchSuggestions.classList.add('hidden');
  }
  activeSuggestionIndex = -1;
  currentSuggestionsList = [];
}

if (chatInput) {
  chatInput.addEventListener('input', (e) => {
    fetchGoogleSuggestions(e.target.value.trim());
  });

  chatInput.addEventListener('keydown', (e) => {
    if (searchSuggestions.classList.contains('hidden') || currentSuggestionsList.length === 0) {
      return;
    }

    const items = searchSuggestions.querySelectorAll('.suggestion-item');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeSuggestionIndex++;
      if (activeSuggestionIndex >= currentSuggestionsList.length) {
        activeSuggestionIndex = 0;
      }
      highlightActiveSuggestion(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeSuggestionIndex--;
      if (activeSuggestionIndex < 0) {
        activeSuggestionIndex = currentSuggestionsList.length - 1;
      }
      highlightActiveSuggestion(items);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideSuggestions();
    }
  });
}

function highlightActiveSuggestion(items) {
  items.forEach((item, idx) => {
    if (idx === activeSuggestionIndex) {
      item.classList.add('active');
      chatInput.value = currentSuggestionsList[idx];
    } else {
      item.classList.remove('active');
    }
  });
}

document.addEventListener('click', (e) => {
  if (searchSuggestions && !searchSuggestions.contains(e.target) && e.target !== chatInput) {
    hideSuggestions();
  }
});

// Google Lens Click Handler
const chatLensBtn = document.getElementById('chat-lens-btn');
if (chatLensBtn) {
  chatLensBtn.addEventListener('click', () => {
    window.open('https://images.google.com/?triggerLens=true', '_blank');
  });
}

// 8. GMAIL NOTIFICATION POLLER
let notifiedEmailIds = new Set();
let isFirstMailCheck = true;

async function checkGmailEmails() {
  if (!TOKEN) return;
  try {
    const res = await fetch(`${BACKEND_URL}/api/mail`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data.connected && data.data.emails) {
        const emails = data.data.emails;
        let newEmailsCount = 0;

        emails.forEach(email => {
          const emailKey = `${email.id}_${email.subject}`;
          if (!notifiedEmailIds.has(emailKey)) {
            notifiedEmailIds.add(emailKey);
            
            if (!isFirstMailCheck) {
              newEmailsCount++;
              
              if (aiSidebarMessages) {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'message assistant';
                msgDiv.innerHTML = `
                  <div class="msg-bubble" style="border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.08);">
                    <strong>✉️ New Email Received</strong><br>
                    <strong>From:</strong> ${escapeHTML(email.from)}<br>
                    <strong>Subject:</strong> ${escapeHTML(email.subject)}
                  </div>
                `;
                aiSidebarMessages.appendChild(msgDiv);
                aiSidebarMessages.scrollTop = aiSidebarMessages.scrollHeight;
              }

              if (typeof chrome !== 'undefined' && chrome.notifications) {
                chrome.notifications.create(`mail-${email.id}-${Date.now()}`, {
                  type: 'basic',
                  iconUrl: 'icon-128.png',
                  title: 'New Gmail Message',
                  message: `From: ${email.from}\nSubject: ${email.subject}`,
                  priority: 2
                });
              }

              try {
                const senderName = email.from.split('<')[0].trim();
                const utterance = new SpeechSynthesisUtterance(`Boss, you have a new email from ${senderName}. The subject is: ${email.subject}`);
                utterance.rate = 1.05;
                window.speechSynthesis.speak(utterance);
              } catch (speechErr) {
                console.error('Speech synthesis failed:', speechErr);
              }
            }
          }
        });

        if (newEmailsCount > 0) {
          if (aiAssistantSidebar && aiAssistantSidebar.classList.contains('closed')) {
            aiAssistantSidebar.classList.remove('closed');
          }
        }
        
        isFirstMailCheck = false;
      }
    }
  } catch (err) {
    console.error('Failed to poll Gmail:', err);
  }
}

// Start polling every 60 seconds
setInterval(checkGmailEmails, 60000);

function triggerAiGmailWelcomeMessage(email) {
  if (aiAssistantSidebar && aiAssistantSidebar.classList.contains('closed')) {
    aiAssistantSidebar.classList.remove('closed');
  }

  if (aiSidebarMessages) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message assistant';
    msgDiv.innerHTML = `
      <div class="msg-bubble" style="border-left: 4px solid #10b981; background: rgba(16, 185, 129, 0.08);">
        ✨ <strong>Gmail Connection Successful!</strong><br>
        Hello, Boss! I have successfully accessed your inbox (<strong>${escapeHTML(email)}</strong>). I will keep an eye on your unread emails and notify you immediately when new messages arrive. Thank you!
      </div>
    `;
    aiSidebarMessages.appendChild(msgDiv);
    aiSidebarMessages.scrollTop = aiSidebarMessages.scrollHeight;
  }

  try {
    const utterance = new SpeechSynthesisUtterance("Boss, I have successfully accessed your inbox. Thank you!");
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error('Failed to speak welcome message:', err);
  }
}



// ============================================================
// 9. QUICK LINKS (WORKSPACE APPS) MODULE
// ============================================================

// Default links shown before user customizes



function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function renderQuickLinks(links) {
  if (!toolsContainer) return;
  toolsContainer.innerHTML = '';
  const displayLinks = links.length > 0 ? links : DEFAULT_QUICK_LINKS;

  displayLinks.forEach(link => {
    // Use gstatic faviconV2 with the full URL — this correctly resolves
    // Google subdomains (mail.google.com → Gmail icon, not Google "G")
    const encodedUrl = encodeURIComponent(link.url);
    const faviconUrl = `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodedUrl}&size=64`;

    const anchor = document.createElement('a');
    anchor.href = link.url;
    anchor.target = '_blank';
    anchor.className = 'tool-btn';
    anchor.title = link.name;
    anchor.dataset.tooltip = `${link.name}: ${link.url}`;

    const img = document.createElement('img');
    img.src = faviconUrl;
    img.className = 'tool-icon-img';
    img.alt = link.name;

    // Delete button (only for user-saved links, not defaults)
    if (links.length > 0) {
      const delBtn = document.createElement('button');
      delBtn.className = 'tool-delete-btn';
      delBtn.innerHTML = '✕';
      delBtn.title = `Remove ${link.name}`;
      delBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteQuickLink(link.url);
      });
      anchor.appendChild(delBtn);
    }

    anchor.appendChild(img);
    toolsContainer.appendChild(anchor);
  });
}

async function loadQuickLinks() {
  if (!TOKEN) return;
  try {
    const res = await fetch(`${BACKEND_URL}/api/links`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        quickLinks = data.data.links || [];
        renderQuickLinks(quickLinks);
      }
    }
  } catch (err) {
    console.error('Failed to load quick links:', err);
    renderQuickLinks([]);
  }
}

async function addQuickLink(name, url) {
  if (!TOKEN) return false;
  try {
    const res = await fetch(`${BACKEND_URL}/api/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({ name, url })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      quickLinks.push(data.data.link);
      renderQuickLinks(quickLinks);
      return true;
    } else {
      Alert.error('Error', data.message || 'Failed to add link.');
      return false;
    }
  } catch (err) {
    console.error('Failed to add quick link:', err);
    Alert.error('Error', 'Failed to add link. Check server connection.');
    return false;
  }
}

async function deleteQuickLink(url) {
  if (!TOKEN) return;
  const confirmed = await Alert.confirmDelete('Remove App', 'Remove this app from Workspace?');
  if (!confirmed) return;
  try {
    const res = await fetch(`${BACKEND_URL}/api/links`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({ url })
    });
    if (res.ok) {
      quickLinks = quickLinks.filter(l => l.url !== url);
      renderQuickLinks(quickLinks);
      Alert.success('Removed', 'App removed from Workspace.');
    }
  } catch (err) {
    console.error('Failed to delete quick link:', err);
  }
}

// Open modal
if (addLinkBtn) {
  addLinkBtn.addEventListener('click', () => {
    addLinkModal.classList.remove('hidden');
    linkNameInput.focus();
  });
}

// Close modal
if (addLinkModalClose) {
  addLinkModalClose.addEventListener('click', () => {
    addLinkModal.classList.add('hidden');
    addLinkForm.reset();
  });
}
if (addLinkModal) {
  addLinkModal.addEventListener('click', (e) => {
    if (e.target === addLinkModal) {
      addLinkModal.classList.add('hidden');
      addLinkForm.reset();
    }
  });
}

// Form submit
if (addLinkForm) {
  addLinkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = linkNameInput.value.trim();
    const url  = linkUrlInput.value.trim();
    if (!name || !url) return;
    const ok = await addQuickLink(name, url);
    if (ok) {
      addLinkModal.classList.add('hidden');
      addLinkForm.reset();
      Alert.success('Added!', `${name} added to Workspace Apps.`);
    }
  });
}

// =====================================================
// GOOGLE CALENDAR LOGIC
// =====================================================


let calCurrentMonth = new Date().getMonth();
let calCurrentYear = new Date().getFullYear();
let calSelectedDateStr = null;
let editingCalEventIdx = null;

function renderCalendarGrid() {
  if (!calendarDaysGrid) return;
  calendarDaysGrid.innerHTML = '';
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  if (calMonthTitle) {
    calMonthTitle.textContent = `${monthNames[calCurrentMonth]} ${calCurrentYear}`;
  }

  // First day of current month (0 = Sunday, 1 = Monday, etc.)
  const firstDayIndex = new Date(calCurrentYear, calCurrentMonth, 1).getDay();
  // Total days in current month
  const totalDays = new Date(calCurrentYear, calCurrentMonth + 1, 0).getDate();
  // Total days in previous month
  const prevMonthTotalDays = new Date(calCurrentYear, calCurrentMonth, 0).getDate();

  // 1. Render padding days from previous month
  for (let i = firstDayIndex; i > 0; i--) {
    const dayNum = prevMonthTotalDays - i + 1;
    const cellMonth = calCurrentMonth === 0 ? 11 : calCurrentMonth - 1;
    const cellYear = calCurrentMonth === 0 ? calCurrentYear - 1 : calCurrentYear;
    createDayCell(dayNum, cellMonth, cellYear, true);
  }

  // 2. Render current month days
  for (let i = 1; i <= totalDays; i++) {
    createDayCell(i, calCurrentMonth, calCurrentYear, false);
  }

  // 3. Render padding days from next month to complete standard 42 cell grid
  const totalGridCells = 42;
  const renderedCells = firstDayIndex + totalDays;
  const nextMonthPadding = totalGridCells - renderedCells;
  
  for (let i = 1; i <= nextMonthPadding; i++) {
    const cellMonth = calCurrentMonth === 11 ? 0 : calCurrentMonth + 1;
    const cellYear = calCurrentMonth === 11 ? calCurrentYear + 1 : calCurrentYear;
    createDayCell(i, cellMonth, cellYear, true);
  }
}

function createDayCell(dayNum, month, year, isOtherMonth) {
  const cell = document.createElement('div');
  cell.className = 'cal-day-cell';
  if (isOtherMonth) {
    cell.classList.add('other-month');
  }

  const today = new Date();
  const isToday = today.getDate() === dayNum && today.getMonth() === month && today.getFullYear() === year;
  if (isToday && !isOtherMonth) {
    cell.classList.add('today');
  }

  // Formatting date string: YYYY-MM-DD
  const formatM = String(month + 1).padStart(2, '0');
  const formatD = String(dayNum).padStart(2, '0');
  const dateStr = `${year}-${formatM}-${formatD}`;

  cell.innerHTML = `
    <div class="cal-day-number">${dayNum}</div>
    <div class="cal-day-events-preview" id="preview-${dateStr}"></div>
  `;

  // Populate events preview chips (max 3)
  const dayEvents = calendarEvents[dateStr] || [];
  const previewContainer = cell.querySelector(`.cal-day-events-preview`);
  if (previewContainer) {
    dayEvents.slice(0, 3).forEach(event => {
      const chip = document.createElement('div');
      const priority = event.priority || 'normal';
      chip.className = `cal-event-preview-chip chip-priority-${priority}`;
      chip.textContent = `${event.time} ${event.desc}`;
      chip.title = `${event.time} - ${event.desc}`;
      previewContainer.appendChild(chip);
    });
  }

  // Click on date cell to open modal
  cell.addEventListener('click', () => {
    openCalendarEventModal(dateStr, dayNum, month, year);
  });

  calendarDaysGrid.appendChild(cell);
}

function openCalendarEventModal(dateStr, dayNum, month, year) {
  calSelectedDateStr = dateStr;
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  if (calModalDateTitle) {
    calModalDateTitle.textContent = `Events for ${monthNames[month]} ${dayNum}, ${year}`;
  }

  renderModalEvents();

  if (calendarEventModal) {
    calendarEventModal.classList.remove('hidden');
  }
}

function renderModalEvents() {
  if (!calEventsList) return;
  calEventsList.innerHTML = '';
  
  const dayEvents = calendarEvents[calSelectedDateStr] || [];
  if (dayEvents.length === 0) {
    calEventsList.innerHTML = `
      <div style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 20px 0;">
        No events scheduled for this day.
      </div>
    `;
    return;
  }

  dayEvents.forEach((event, idx) => {
    const priority = event.priority || 'normal';
    let badgeClass = 'badge-normal';
    let badgeLabel = 'Normal';
    if (priority === 'important') {
      badgeClass = 'badge-important';
      badgeLabel = 'Important';
    } else if (priority === 'emergency') {
      badgeClass = 'badge-emergency';
      badgeLabel = 'Emergency';
    }

    const item = document.createElement('div');
    item.className = 'cal-event-item';
    item.innerHTML = `
      <div class="cal-event-item-info">
        <span class="cal-event-item-time">${formatTimeHelper(event.time)}</span>
        <span class="priority-badge ${badgeClass}">${badgeLabel}</span>
        <span class="cal-event-item-desc">${event.desc}</span>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button type="button" class="cal-event-item-edit" data-idx="${idx}" title="Edit Event" style="background: transparent; border: none; font-size: 13px; cursor: pointer; opacity: 0.6; transition: opacity 0.2s, transform 0.2s; outline: none;">✏️</button>
        <button type="button" class="cal-event-item-delete" data-idx="${idx}" title="Delete Event">&times;</button>
      </div>
    `;

    item.querySelector('.cal-event-item-edit').addEventListener('click', (e) => {
      const editIdx = parseInt(e.currentTarget.getAttribute('data-idx'));
      startEditingCalendarEvent(editIdx);
    });

    item.querySelector('.cal-event-item-delete').addEventListener('click', (e) => {
      const deleteIdx = parseInt(e.currentTarget.getAttribute('data-idx'));
      deleteCalendarEvent(deleteIdx);
    });

    calEventsList.appendChild(item);
  });
}

function formatTimeHelper(time24) {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${mStr} ${ampm}`;
}

async function deleteCalendarEvent(idx) {
  const confirmed = await Alert.confirmDelete('Delete Event', 'Are you sure you want to delete this event?');
  if (confirmed && calSelectedDateStr) {
    const dayEvents = calendarEvents[calSelectedDateStr] || [];
    dayEvents.splice(idx, 1);
    
    if (dayEvents.length === 0) {
      delete calendarEvents[calSelectedDateStr];
    } else {
      calendarEvents[calSelectedDateStr] = dayEvents;
    }

    chrome.storage.local.set({ calendar_events: calendarEvents }, () => {
      renderModalEvents();
      renderCalendarGrid();
    });
  }
}

// View switching
if (viewDashboardBtn && viewCalendarBtn) {
  viewDashboardBtn.addEventListener('click', () => {
    viewDashboardBtn.classList.add('active');
    viewCalendarBtn.classList.remove('active');
    
    mainDashboardView.classList.remove('hidden');
    calendarViewWrapper.classList.add('hidden');
  });

  viewCalendarBtn.addEventListener('click', () => {
    viewCalendarBtn.classList.add('active');
    viewDashboardBtn.classList.remove('active');
    
    calendarViewWrapper.classList.remove('hidden');
    mainDashboardView.classList.add('hidden');
    
    renderCalendarGrid();
  });
}

// Month Navigation Listeners
if (calPrevMonthBtn) {
  calPrevMonthBtn.addEventListener('click', () => {
    if (calCurrentMonth === 0) {
      calCurrentMonth = 11;
      calCurrentYear--;
    } else {
      calCurrentMonth--;
    }
    renderCalendarGrid();
  });
}

if (calNextMonthBtn) {
  calNextMonthBtn.addEventListener('click', () => {
    if (calCurrentMonth === 11) {
      calCurrentMonth = 0;
      calCurrentYear++;
    } else {
      calCurrentMonth++;
    }
    renderCalendarGrid();
  });
}

if (calTodayBtn) {
  calTodayBtn.addEventListener('click', () => {
    const today = new Date();
    calCurrentMonth = today.getMonth();
    calCurrentYear = today.getFullYear();
    renderCalendarGrid();
  });
}

function clearCalEventEditState() {
  editingCalEventIdx = null;
  if (calEventForm) calEventForm.reset();
  const cancelBtn = document.getElementById('cal-cancel-edit-btn');
  if (cancelBtn) cancelBtn.classList.add('hidden');
  const submitBtn = calEventForm ? calEventForm.querySelector('button[type="submit"]') : null;
  if (submitBtn) submitBtn.textContent = 'Add Schedule Event';
}

// Modal closing
if (calModalCloseBtn) {
  calModalCloseBtn.addEventListener('click', () => {
    calendarEventModal.classList.add('hidden');
    clearCalEventEditState();
  });
}

if (calendarEventModal) {
  calendarEventModal.addEventListener('click', (e) => {
    if (e.target === calendarEventModal) {
      calendarEventModal.classList.add('hidden');
      clearCalEventEditState();
    }
  });
}

// Form event add listener
if (calEventForm) {
  calEventForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const timeVal = calEventTime.value;
    const descVal = calEventDesc.value.trim();
    const priorityVal = calEventPriority ? calEventPriority.value : 'normal';

    if (!timeVal || !descVal || !calSelectedDateStr) return;

    const dayEvents = calendarEvents[calSelectedDateStr] || [];

    if (editingCalEventIdx !== null) {
      // Edit Mode: Update existing event
      const eventToUpdate = dayEvents[editingCalEventIdx];
      if (eventToUpdate) {
        eventToUpdate.time = timeVal;
        eventToUpdate.desc = descVal;
        eventToUpdate.priority = priorityVal;
      }
      editingCalEventIdx = null;
      
      const submitBtn = calEventForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Add Schedule Event';
      
      const cancelBtn = document.getElementById('cal-cancel-edit-btn');
      if (cancelBtn) cancelBtn.classList.add('hidden');
    } else {
      // Add Mode: Create new event
      const newEvent = {
        id: 'evt-' + Date.now(),
        time: timeVal,
        desc: descVal,
        priority: priorityVal
      };
      dayEvents.push(newEvent);
    }

    calendarEvents[calSelectedDateStr] = dayEvents;
    calendarEvents[calSelectedDateStr].sort((a, b) => a.time.localeCompare(b.time));

    chrome.storage.local.set({ calendar_events: calendarEvents }, () => {
      renderModalEvents();
      renderCalendarGrid();
      calEventForm.reset();
      syncTodayCalendarEventsToRoutines();
    });
  });
}

// Cancel Edit Button
const calCancelEditBtn = document.getElementById('cal-cancel-edit-btn');
if (calCancelEditBtn) {
  calCancelEditBtn.addEventListener('click', () => {
    clearCalEventEditState();
  });
}

function startEditingCalendarEvent(idx) {
  const dayEvents = calendarEvents[calSelectedDateStr] || [];
  const event = dayEvents[idx];
  if (!event) return;
  
  editingCalEventIdx = idx;
  calEventTime.value = event.time;
  if (calEventPriority) calEventPriority.value = event.priority || 'normal';
  calEventDesc.value = event.desc;
  
  const submitBtn = calEventForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Update Schedule Event';
  
  const cancelBtn = document.getElementById('cal-cancel-edit-btn');
  if (cancelBtn) cancelBtn.classList.remove('hidden');
  
  calEventDesc.focus();
}

// ============================================================
// QUICK NOTE CONTROLLER
// ============================================================
const quickNoteTextarea = document.getElementById('quick-note-textarea');
const clearNoteBtn = document.getElementById('clear-note-btn');

if (quickNoteTextarea) {
  // Load note on start
  const savedNote = localStorage.getItem('quick_note');
  if (savedNote) {
    quickNoteTextarea.value = savedNote;
  }
  
  // Autosave on input
  quickNoteTextarea.addEventListener('input', () => {
    localStorage.setItem('quick_note', quickNoteTextarea.value);
  });
}

if (clearNoteBtn && quickNoteTextarea) {
  clearNoteBtn.addEventListener('click', async () => {
    const confirmed = await Alert.confirmDelete('Clear Note', 'Are you sure you want to clear your quick notes?');
    if (confirmed) {
      quickNoteTextarea.value = '';
      localStorage.removeItem('quick_note');
      Alert.success('Cleared', 'Notes cleared successfully.');
    }
  });
}
