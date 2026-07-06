// Listen for Chrome alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('class_alarm_')) {
    try {
      const parts = alarm.name.split('_');
      const className = decodeURIComponent(parts[3] || 'Class');
      const room = decodeURIComponent(parts[4] || '');
      const messageStr = room
        ? `Your class "${className}" starts in 10 minutes in Room ${room}!`
        : `Your class "${className}" starts in 10 minutes!`;
      chrome.notifications.create(`reminder-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: 'Upcoming Class Reminder',
        message: messageStr,
        priority: 2,
        requireInteraction: true
      });
    } catch (e) {
      console.error('Error processing class alarm:', e);
    }
  }

  // Focus Mode check alarm
  if (alarm.name === 'focus_mode_check') {
    checkFocusSessions();
  }
});

// ── Website Time Tracking Logic ──
let activeTabDomain = null;
let activeTabStartTime = Date.now();

try {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      activeTabDomain = getDomain(tabs[0].url);
      activeTabStartTime = Date.now();
    }
  });
} catch (e) {
  console.error('Error querying active tab on startup:', e);
}

function getDomain(url) {
  try {
    if (!url) return null;
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      let host = parsed.hostname;
      if (host.startsWith('www.')) host = host.slice(4);
      return host;
    }
  } catch (e) {}
  return null;
}

function getTodayDateString() {
  const localDate = new Date();
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function logTimeSpent() {
  if (!activeTabDomain) return;
  const now = Date.now();
  const elapsedSeconds = Math.round((now - activeTabStartTime) / 1000);
  if (elapsedSeconds <= 0) return;
  activeTabStartTime = now;
  const todayStr = `daily_usage_${getTodayDateString()}`;
  chrome.storage.local.get([todayStr], (result) => {
    const stats = result[todayStr] || {};
    stats[activeTabDomain] = (stats[activeTabDomain] || 0) + elapsedSeconds;
    const saveData = {};
    saveData[todayStr] = stats;
    chrome.storage.local.set(saveData);
  });
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  logTimeSpent();
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    activeTabDomain = getDomain(tab?.url);
    activeTabStartTime = Date.now();
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id === tabId) {
        logTimeSpent();
        activeTabDomain = getDomain(changeInfo.url);
        activeTabStartTime = Date.now();
      }
    });
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  logTimeSpent();
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    activeTabDomain = null;
  } else {
    chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
      if (tabs.length > 0) {
        activeTabDomain = getDomain(tabs[0].url);
        activeTabStartTime = Date.now();
      }
    });
  }
});

setInterval(() => { logTimeSpent(); }, 30000);

// ════════════════════════════════════════════════════════
//  FOCUS MODE — Website Blocker
// ════════════════════════════════════════════════════════

// Start a recurring alarm to check focus sessions every minute
chrome.alarms.create('focus_mode_check', { periodInMinutes: 1 });

// Run immediately on service worker startup too
checkFocusSessions();

/**
 * Check if any focus session is currently active.
 * If yes → apply block rules for its domains.
 * If no  → remove all block rules.
 */
function checkFocusSessions() {
  chrome.storage.local.get(['focus_sessions'], (result) => {
    const sessions = result.focus_sessions || [];
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const today = dayNames[now.getDay()];

    let allBlockedDomains = [];

    sessions.forEach(session => {
      if (!session.active) return;

      // Check day match
      const days = session.days || ['mon','tue','wed','thu','fri','sat','sun'];
      if (!days.includes(today)) return;

      // Parse times
      const [startH, startM] = session.startTime.split(':').map(Number);
      const [endH, endM] = session.endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      // Check if current time is within the session window
      const inWindow = endMinutes > startMinutes
        ? currentMinutes >= startMinutes && currentMinutes < endMinutes
        : currentMinutes >= startMinutes || currentMinutes < endMinutes; // overnight session

      if (inWindow) {
        allBlockedDomains = allBlockedDomains.concat(session.domains || []);
      }
    });

    // Deduplicate
    allBlockedDomains = [...new Set(allBlockedDomains)];

    if (allBlockedDomains.length > 0) {
      applyBlockRules(allBlockedDomains);
    } else {
      removeAllBlockRules();
    }
  });
}

/**
 * Apply declarativeNetRequest dynamic rules to block the given domains.
 * Redirects blocked pages to the extension's newtab with ?blocked=1&site=domain
 */
function applyBlockRules(domains) {
  // First remove existing rules, then add new ones
  chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
    const existingIds = existingRules.map(r => r.id);

    const newRules = domains.map((domain, idx) => ({
      id: idx + 1,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          extensionPath: `/newtab.html?blocked=1&site=${encodeURIComponent(domain)}`
        }
      },
      condition: {
        urlFilter: `||${domain}^`,
        resourceTypes: ['main_frame']
      }
    }));

    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: newRules
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Focus block error:', chrome.runtime.lastError);
      }
    });
  });
}

/**
 * Remove all dynamic blocking rules (end of focus session)
 */
function removeAllBlockRules() {
  chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
    if (existingRules.length === 0) return;
    const ids = existingRules.map(r => r.id);
    chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids }, () => {
      if (chrome.runtime.lastError) {
        console.error('Focus unblock error:', chrome.runtime.lastError);
      }
    });
  });
}


      const messageStr = room 
        ? `Your class "${className}" starts in 10 minutes in Room ${room}!` 
        : `Your class "${className}" starts in 10 minutes!`;

      chrome.notifications.create(`reminder-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icon-128.png', // Fallback to icon-128.png in the same directory
        title: 'Upcoming Class Reminder',
        message: messageStr,
        priority: 2,
        requireInteraction: true // Keeps notification visible until user interacts
      });
    } catch (e) {
      console.error('Error processing class alarm:', e);
    }
  }
});

// Website Time Tracking Logic
let activeTabDomain = null;
let activeTabStartTime = Date.now();

// Query active tab on startup
try {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      activeTabDomain = getDomain(tabs[0].url);
      activeTabStartTime = Date.now();
    }
  });
} catch (e) {
  console.error('Error querying active tab on startup:', e);
}

// Helper to get domain name from URL
function getDomain(url) {
  try {
    if (!url) return null;
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      let host = parsed.hostname;
      if (host.startsWith('www.')) {
        host = host.slice(4);
      }
      return host;
    }
  } catch (e) {
    // Ignore invalid URLs
  }
  return null;
}

// Helper to get date string in YYYY-MM-DD local format
function getTodayDateString() {
  const localDate = new Date();
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Log time spent on current active tab
function logTimeSpent() {
  if (!activeTabDomain) return;

  const now = Date.now();
  const elapsedSeconds = Math.round((now - activeTabStartTime) / 1000);
  if (elapsedSeconds <= 0) return;

  // Reset timer start
  activeTabStartTime = now;

  const todayStr = `daily_usage_${getTodayDateString()}`;

  chrome.storage.local.get([todayStr], (result) => {
    const stats = result[todayStr] || {};
    stats[activeTabDomain] = (stats[activeTabDomain] || 0) + elapsedSeconds;
    
    const saveData = {};
    saveData[todayStr] = stats;
    chrome.storage.local.set(saveData);
  });
}

// Track when tab is switched/activated
chrome.tabs.onActivated.addListener((activeInfo) => {
  logTimeSpent();
  
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    activeTabDomain = getDomain(tab?.url);
    activeTabStartTime = Date.now();
  });
});

// Track when tab URL is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    // Check if the updated tab is the currently active one
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id === tabId) {
        logTimeSpent();
        activeTabDomain = getDomain(changeInfo.url);
        activeTabStartTime = Date.now();
      }
    });
  }
});

// Track window focus changes (e.g. if user minimizes chrome or leaves it)
chrome.windows.onFocusChanged.addListener((windowId) => {
  logTimeSpent();
  
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    activeTabDomain = null;
  } else {
    chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
      if (tabs.length > 0) {
        activeTabDomain = getDomain(tabs[0].url);
        activeTabStartTime = Date.now();
      }
    });
  }
});

// Periodic sync (every 30 seconds) to ensure time isn't lost
setInterval(() => {
  logTimeSpent();
}, 30000);

// Storage change listener to update dynamic blocker rules immediately
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.focus_sessions) {
    checkFocusSessions();
  }
});
