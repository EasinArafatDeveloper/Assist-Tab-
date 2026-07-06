// Mock chrome.storage if running outside of extension context (e.g. for testing in web browser)
if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
  window.chrome = window.chrome || {};
  chrome.storage = {
    local: {
      get: (keys, callback) => {
        const result = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach(key => {
          try {
            const val = localStorage.getItem(key);
            result[key] = val ? JSON.parse(val) : null;
          } catch(e) {
            result[key] = localStorage.getItem(key);
          }
        });
        setTimeout(() => callback(result), 0);
      },
      set: (data, callback) => {
        Object.keys(data).forEach(key => {
          localStorage.setItem(key, typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]);
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

// Global variables
let TOKEN = null;
let BACKEND_URL = 'http://localhost:3000';
let CURRENT_THEME = 'dark';
let CURRENT_PROVIDER = 'deepseek';
let SAVED_SESSIONS = [];
let focusBlockedDomains = []; // Temporary storage for domains in "add session" form
let hasUnsavedChanges = false;

// DOM Elements
const tabBtns = document.querySelectorAll('.nav-tab-btn');
const panels = document.querySelectorAll('.settings-panel');
const unsavedWarning = document.querySelector('.unsaved-warning');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const logoutBtn = document.getElementById('logout-btn');

// General Setting Elements
const themeSelect = document.getElementById('settings-theme');
const backendUrlInput = document.getElementById('settings-backend-url');

// AI Setting Elements
const aiProviderSelect = document.getElementById('settings-ai-provider');
const deepseekKeyInput = document.getElementById('settings-deepseek-key');
const geminiKeyInput = document.getElementById('settings-gemini-key');
const openaiKeyInput = document.getElementById('settings-openai-key');
const anthropicKeyInput = document.getElementById('settings-anthropic-key');
const providerKeyInputs = document.querySelectorAll('.provider-key-input');

// Gmail Notification Elements
const gmailAddressInput = document.getElementById('settings-gmail-address');
const gmailPasswordInput = document.getElementById('settings-gmail-password');
const gmailStatusBadge = document.getElementById('gmail-status-badge');
const disconnectGmailBtn = document.getElementById('disconnect-gmail-btn');

// Focus Mode Elements
const focusStatusBadge = document.getElementById('focus-mode-status-badge');
const focusSessionNameInput = document.getElementById('focus-session-name');
const focusDomainInput = document.getElementById('focus-domain-input');
const focusAddDomainBtn = document.getElementById('focus-add-domain-btn');
const focusDomainTagsContainer = document.getElementById('focus-domain-tags');
const focusStartTimeInput = document.getElementById('focus-start-time');
const focusEndTimeInput = document.getElementById('focus-end-time');
const focusSaveSessionBtn = document.getElementById('focus-save-session-btn');
const focusSessionsList = document.getElementById('focus-sessions-list');

// ════════════════════════════════════════════════════════
// 1. INITIALIZATION & DATA LOADING
// ════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Load configuration from local storage
  chrome.storage.local.get([
    'jwt_token', 'backend_url', 'deepseek_key', 'gemini_key', 'openai_key', 'claude_key', 'ai_provider', 'theme', 'focus_sessions'
  ], async (result) => {
    // 1. Theme Configuration
    CURRENT_THEME = result.theme || 'dark';
    document.body.setAttribute('data-theme', CURRENT_THEME);
    if (themeSelect) themeSelect.value = CURRENT_THEME;

    // 2. Backend URL Configuration
    if (result.backend_url) {
      BACKEND_URL = result.backend_url;
      if (backendUrlInput) backendUrlInput.value = BACKEND_URL;
    }

    // 3. AI Settings
    if (result.ai_provider) {
      CURRENT_PROVIDER = result.ai_provider;
      if (aiProviderSelect) aiProviderSelect.value = CURRENT_PROVIDER;
    }

    if (result.deepseek_key) deepseekKeyInput.value = result.deepseek_key;
    if (result.gemini_key) geminiKeyInput.value = result.gemini_key;
    if (result.openai_key) openaiKeyInput.value = result.openai_key;
    if (result.claude_key) anthropicKeyInput.value = result.claude_key;

    toggleKeyInputFields(CURRENT_PROVIDER);

    // 4. Gmail Connection Check
    if (result.jwt_token) {
      TOKEN = result.jwt_token;
      fetchGmailConfig();
    } else {
      // If no token is present, we disable Gmail configuration elements since user isn't logged in
      disableGmailConfig();
    }

    // 5. Focus sessions
    try {
      SAVED_SESSIONS = Array.isArray(result.focus_sessions) 
        ? result.focus_sessions 
        : (typeof result.focus_sessions === 'string' ? JSON.parse(result.focus_sessions) : []);
    } catch(e) {
      SAVED_SESSIONS = [];
    }
    renderFocusSessions();
    updateFocusOverallStatusBadge();

    // Reset unsaved changes tracking after initial loads
    hasUnsavedChanges = false;
    toggleUnsavedWarning(false);
  });

  // Attach interactive UI event listeners
  setupTabNavigation();
  setupUIHelpers();
  setupFocusFormHandlers();
  setupUnsavedChangesDetection();
});

// Show dynamic API key configuration field based on provider
function toggleKeyInputFields(provider) {
  providerKeyInputs.forEach(input => {
    if (input.id === `provider-key-${provider}`) {
      input.classList.remove('hidden');
    } else {
      input.classList.add('hidden');
    }
  });
}

// ════════════════════════════════════════════════════════
// 2. SIDEBAR TAB INTERACTION
// ════════════════════════════════════════════════════════

function setupTabNavigation() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');

      // Update active nav button styling
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update active panel visibility with fade-in effect
      panels.forEach(panel => {
        if (panel.id === `panel-${tabId}`) {
          panel.classList.add('active');
        } else {
          panel.classList.remove('active');
        }
      });
    });
  });
}

// ════════════════════════════════════════════════════════
// 3. PASSWORD VISIBILITY & INPUTS HELPERS
// ════════════════════════════════════════════════════════

function setupUIHelpers() {
  // Toggle password visibility (eye icon buttons)
  const passwordTogglers = document.querySelectorAll('.toggle-password-btn');
  passwordTogglers.forEach(btn => {
    btn.addEventListener('click', () => {
      const wrapper = btn.closest('.password-input-wrapper');
      const input = wrapper ? wrapper.querySelector('input') : null;
      if (input) {
        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = '🙈';
        } else {
          input.type = 'password';
          btn.textContent = '👁️';
        }
      }
    });
  });

  // Dynamic Provider Select Event
  if (aiProviderSelect) {
    aiProviderSelect.addEventListener('change', () => {
      CURRENT_PROVIDER = aiProviderSelect.value;
      toggleKeyInputFields(CURRENT_PROVIDER);
    });
  }

  // Logout button implementation
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const confirmed = await Alert.confirmDelete('Log Out Account', 'Are you sure you want to log out?');
      if (confirmed) {
        TOKEN = null;
        chrome.storage.local.remove('jwt_token', () => {
          // Clear notification alarms if chrome alarms exists
          if (typeof chrome !== 'undefined' && chrome.alarms) {
            chrome.alarms.clearAll();
          }
          Alert.success('Logged Out', 'Redirecting...');
          setTimeout(() => {
            window.location.href = 'newtab.html';
          }, 1000);
        });
      }
    });
  }
}

// ════════════════════════════════════════════════════════
// 4. GMAIL CONFIGURATION SERVICES
// ════════════════════════════════════════════════════════

async function fetchGmailConfig() {
  if (!TOKEN) return;
  try {
    const res = await fetch(`${BACKEND_URL}/api/mail/config`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    if (res.ok) {
      const payload = await res.json();
      if (payload.success && payload.data) {
        gmailAddressInput.value = payload.data.gmailAddress || '';
        if (payload.data.hasPassword) {
          gmailPasswordInput.value = '';
          gmailPasswordInput.placeholder = '•••••••• (Saved)';
          gmailStatusBadge.textContent = 'CONNECTED';
          gmailStatusBadge.className = 'gmail-status-badge status-connected';
          disconnectGmailBtn.classList.remove('hidden');
        } else {
          gmailPasswordInput.value = '';
          gmailPasswordInput.placeholder = 'xxxx xxxx xxxx xxxx';
          gmailStatusBadge.textContent = 'Disconnected';
          gmailStatusBadge.className = 'gmail-status-badge status-disconnected';
          disconnectGmailBtn.classList.add('hidden');
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch Gmail configurations:', err);
    disableGmailConfig();
  }
}

function disableGmailConfig() {
  if (gmailAddressInput) {
    gmailAddressInput.disabled = true;
    gmailAddressInput.placeholder = 'Sign in to configure Gmail integration';
  }
  if (gmailPasswordInput) {
    gmailPasswordInput.disabled = true;
    gmailPasswordInput.placeholder = 'Sign in to configure Gmail integration';
  }
  if (disconnectGmailBtn) disconnectGmailBtn.classList.add('hidden');
  if (gmailStatusBadge) {
    gmailStatusBadge.textContent = 'Unavailable';
    gmailStatusBadge.className = 'gmail-status-badge status-disconnected';
  }
}

// Disconnect Gmail listener
if (disconnectGmailBtn) {
  disconnectGmailBtn.addEventListener('click', async () => {
    const confirmed = await Alert.confirmDelete('Disconnect Gmail', 'Are you sure you want to disconnect Gmail? You will no longer receive mail voice alerts.');
    if (confirmed) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/mail/config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
          },
          body: JSON.stringify({ gmailAddress: '', gmailAppPassword: '' })
        });

        if (res.ok) {
          gmailAddressInput.value = '';
          gmailPasswordInput.value = '';
          gmailPasswordInput.placeholder = 'xxxx xxxx xxxx xxxx';
          gmailStatusBadge.textContent = 'Disconnected';
          gmailStatusBadge.className = 'gmail-status-badge status-disconnected';
          disconnectGmailBtn.classList.add('hidden');
          
          Alert.success('Gmail Disconnected');
          
          try {
            const utterance = new SpeechSynthesisUtterance("Boss, Gmail has been disconnected successfully.");
            window.speechSynthesis.speak(utterance);
          } catch(e) {}
        }
      } catch (err) {
        console.error('Gmail disconnect error:', err);
        Alert.error('Error', 'Failed to disconnect Gmail.');
      }
    }
  });
}

// ════════════════════════════════════════════════════════
// 5. FOCUS BLOCKER INTERACTIVE FUNCTIONS
// ════════════════════════════════════════════════════════

function setupFocusFormHandlers() {
  // Adding domain tags logic
  focusAddDomainBtn.addEventListener('click', () => {
    addDomainFromInput();
  });

  focusDomainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addDomainFromInput();
    }
  });

  // Saving focus session click logic
  focusSaveSessionBtn.addEventListener('click', () => {
    const sessionName = focusSessionNameInput.value.trim() || `Focus Session #${SAVED_SESSIONS.length + 1}`;
    const startTime = focusStartTimeInput.value;
    const endTime = focusEndTimeInput.value;
    
    // Gather days
    const checkedDays = [];
    const dayInputs = document.querySelectorAll('.focus-day-chips input:checked');
    dayInputs.forEach(input => {
      checkedDays.push(input.value);
    });

    if (focusBlockedDomains.length === 0) {
      Alert.error('No Sites Added', 'Please input at least one website domain to block.');
      return;
    }

    if (checkedDays.length === 0) {
      Alert.error('No Days Selected', 'Please check at least one active day.');
      return;
    }

    // Add session to local state
    const newSession = {
      id: 'session-' + Date.now(),
      name: sessionName,
      domains: [...focusBlockedDomains],
      startTime: startTime,
      endTime: endTime,
      days: checkedDays,
      active: true // default ON
    };

    SAVED_SESSIONS.push(newSession);

    // Save and render
    saveFocusSessionsToStorage();
    renderFocusSessions();
    updateFocusOverallStatusBadge();

    // Reset Form Fields
    focusSessionNameInput.value = '';
    focusBlockedDomains = [];
    renderDomainTags();
    
    // Reset day chips to default (all checked)
    const allDays = document.querySelectorAll('.focus-day-chips input');
    allDays.forEach(input => {
      input.checked = true;
    });

    Alert.success('Session Saved', `"${sessionName}" blocker configuration loaded.`);
    hasUnsavedChanges = true;
    toggleUnsavedWarning(true);
  });
}

// Add a domain tag chip
function addDomainFromInput() {
  const rawDomain = focusDomainInput.value.trim().toLowerCase();
  if (!rawDomain) return;

  // Clean domain name (e.g. remove http:// or https:// if user pasted url)
  let cleanDomain = rawDomain;
  try {
    if (rawDomain.includes('://')) {
      const urlObj = new URL(rawDomain);
      cleanDomain = urlObj.hostname;
    } else {
      // Add fake protocol to parse correctly
      const urlObj = new URL('http://' + rawDomain);
      cleanDomain = urlObj.hostname;
    }
  } catch(e) {
    // Fallback if parsing fails
  }

  // Remove leading www.
  if (cleanDomain.startsWith('www.')) {
    cleanDomain = cleanDomain.substring(4);
  }

  if (cleanDomain && !focusBlockedDomains.includes(cleanDomain)) {
    focusBlockedDomains.push(cleanDomain);
    renderDomainTags();
    focusDomainInput.value = '';
    focusDomainInput.focus();
  }
}

// Render tag chips for current domain form input
function renderDomainTags() {
  focusDomainTagsContainer.innerHTML = '';
  focusBlockedDomains.forEach((domain, index) => {
    const tag = document.createElement('div');
    tag.className = 'focus-domain-tag';
    tag.innerHTML = `
      <span>${domain}</span>
      <button type="button" data-idx="${index}">&times;</button>
    `;

    // Remove tags click
    tag.querySelector('button').addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
      focusBlockedDomains.splice(idx, 1);
      renderDomainTags();
    });

    focusDomainTagsContainer.appendChild(tag);
  });
}

// Render the list of Focus Sessions
function renderFocusSessions() {
  focusSessionsList.innerHTML = '';

  if (SAVED_SESSIONS.length === 0) {
    focusSessionsList.innerHTML = `
      <div class="loading-placeholder" style="font-size: 12px; padding: 12px 0;">No saved focus sessions yet. Customize domains and times above to create one.</div>
    `;
    return;
  }

  SAVED_SESSIONS.forEach((session, sIdx) => {
    const card = document.createElement('div');
    card.className = 'focus-session-card';
    card.innerHTML = `
      <div class="session-info">
        <div class="session-title-row">
          <span class="session-name-title">${session.name}</span>
          ${session.active ? '<span class="session-badge-active">Running</span>' : ''}
        </div>
        <div class="session-time-text">
          🕒 ${formatTime(session.startTime)} – ${formatTime(session.endTime)}
        </div>
        <div class="session-days-row">
          ${['mon','tue','wed','thu','fri','sat','sun'].map(day => {
            const isSelected = session.days.includes(day);
            return `<span class="session-day-tag ${isSelected ? 'active' : ''}">${day.substring(0,3)}</span>`;
          }).join('')}
        </div>
        <div class="session-domains-summary">
          🔒 Blocks: ${session.domains.join(', ')}
        </div>
      </div>
      <div class="session-actions-row">
        <!-- Switch Toggle -->
        <label class="switch-control">
          <input type="checkbox" class="session-toggle-active" data-idx="${sIdx}" ${session.active ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
        <!-- Delete Button -->
        <button type="button" class="session-delete-btn" data-idx="${sIdx}" title="Delete Session">&times;</button>
      </div>
    `;

    // Active Toggle event listener
    card.querySelector('.session-toggle-active').addEventListener('change', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
      SAVED_SESSIONS[idx].active = e.currentTarget.checked;
      saveFocusSessionsToStorage();
      renderFocusSessions();
      updateFocusOverallStatusBadge();
      
      hasUnsavedChanges = true;
      toggleUnsavedWarning(true);
    });

    // Delete session event listener
    card.querySelector('.session-delete-btn').addEventListener('click', async (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
      const confirmed = await Alert.confirmDelete('Delete Session', `Are you sure you want to delete "${SAVED_SESSIONS[idx].name}"?`);
      if (confirmed) {
        SAVED_SESSIONS.splice(idx, 1);
        saveFocusSessionsToStorage();
        renderFocusSessions();
        updateFocusOverallStatusBadge();
        
        hasUnsavedChanges = true;
        toggleUnsavedWarning(true);
      }
    });

    focusSessionsList.appendChild(card);
  });
}

function formatTime(timeStr) {
  if (!timeStr) return '00:00';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  const displayM = m < 10 ? '0' + m : m;
  return `${displayH}:${displayM} ${ampm}`;
}

// Save focus sessions directly to chrome storage
function saveFocusSessionsToStorage() {
  chrome.storage.local.set({ focus_sessions: SAVED_SESSIONS });
}

// Update overall badge (ON/OFF)
function updateFocusOverallStatusBadge() {
  const hasActiveSession = SAVED_SESSIONS.some(session => session.active);
  if (hasActiveSession) {
    focusStatusBadge.textContent = 'ON';
    focusStatusBadge.className = 'focus-status-badge active';
  } else {
    focusStatusBadge.textContent = 'OFF';
    focusStatusBadge.className = 'focus-status-badge inactive';
  }
}

// ════════════════════════════════════════════════════════
// 6. UNSAVED CHANGES TRACKER
// ════════════════════════════════════════════════════════

function setupUnsavedChangesDetection() {
  const inputsToMonitor = [
    themeSelect,
    backendUrlInput,
    aiProviderSelect,
    deepseekKeyInput,
    geminiKeyInput,
    openaiKeyInput,
    anthropicKeyInput,
    gmailAddressInput,
    gmailPasswordInput
  ];

  inputsToMonitor.forEach(input => {
    if (input) {
      input.addEventListener('input', () => markUnsaved());
      input.addEventListener('change', () => markUnsaved());
    }
  });

  function markUnsaved() {
    hasUnsavedChanges = true;
    toggleUnsavedWarning(true);
  }
}

function toggleUnsavedWarning(show) {
  if (unsavedWarning) {
    if (show) {
      unsavedWarning.classList.remove('hidden');
    } else {
      unsavedWarning.classList.add('hidden');
    }
  }
}

// Prompt on unsaved changes navigation exit
window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    return e.returnValue;
  }
});

// ════════════════════════════════════════════════════════
// 7. SAVING MAIN CONFIGURATIONS & API POSTS
// ════════════════════════════════════════════════════════

saveSettingsBtn.addEventListener('click', async () => {
  const selectedTheme = themeSelect ? themeSelect.value : 'dark';
  const backendUrl = backendUrlInput ? backendUrlInput.value.trim() : 'http://localhost:3000';
  const selectedProvider = aiProviderSelect ? aiProviderSelect.value : 'deepseek';

  const rawDeepseek = deepseekKeyInput.value.trim();
  const rawGemini = geminiKeyInput.value.trim();
  const rawOpenai = openaiKeyInput.value.trim();
  const rawClaude = anthropicKeyInput.value.trim();

  const gmailAddress = gmailAddressInput ? gmailAddressInput.value.trim() : '';
  const gmailPassword = gmailPasswordInput ? gmailPasswordInput.value.trim() : '';

  if (!backendUrl) {
    Alert.error('URL Required', 'Please set a valid Backend Server URL.');
    return;
  }

  // 1. Update theme
  CURRENT_THEME = selectedTheme;
  document.body.setAttribute('data-theme', CURRENT_THEME);

  // 2. Set storage configurations
  const newStorageConfigs = {
    theme: selectedTheme,
    backend_url: backendUrl,
    ai_provider: selectedProvider,
    deepseek_key: rawDeepseek || null,
    gemini_key: rawGemini || null,
    openai_key: rawOpenai || null,
    claude_key: rawClaude || null
  };

  // 3. Post Gmail configurations to backend
  if (TOKEN && (gmailAddress || gmailPassword)) {
    const gmailPayload = { gmailAddress };
    if (gmailPassword) {
      gmailPayload.gmailAppPassword = gmailPassword;
    }

    try {
      const res = await fetch(`${backendUrl}/api/mail/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify(gmailPayload)
      });
      
      if (res.ok && gmailAddress && gmailPassword) {
        triggerVoiceWelcome(gmailAddress);
      }
    } catch(err) {
      console.error('Failed to sync Gmail configuration to backend:', err);
    }
  }

  // 4. Save to chrome local storage
  chrome.storage.local.set(newStorageConfigs, () => {
    hasUnsavedChanges = false;
    toggleUnsavedWarning(false);
    
    // Refresh configurations locally
    BACKEND_URL = backendUrl;
    CURRENT_PROVIDER = selectedProvider;

    Alert.success('Settings Saved', 'Configuration successfully synchronized.');
    
    // Refresh Gmail Config info (changes placeholder to "Saved" if password input was written)
    if (TOKEN) {
      fetchGmailConfig();
    }
  });
});

// Gmail speech synthesis welcome logic
function triggerVoiceWelcome(email) {
  try {
    const emailUsername = email.split('@')[0];
    const capitalizedUser = emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1);
    const speechText = `Gmail successfully synchronized. Welcome aboard, Boss. I am monitoring ${capitalizedUser}'s inbox now.`;
    const utterance = new SpeechSynthesisUtterance(speechText);
    window.speechSynthesis.speak(utterance);
  } catch(e) {
    console.error('Voice synthesis failed:', e);
  }
}
