// PeasyProxy - Backup & Restore Module
// Handles backup export, import, and cloud sync

const BACKUP_VERSION = '1.0.0';

// Export backup
async function exportBackup() {
  try {
    const data = await chrome.storage.local.get(null);
    
    const backup = {
      version: BACKUP_VERSION,
      timestamp: Date.now(),
      data: {
        settings: data.settings || {},
        favorites: data.favorites || [],
        recentlyUsed: data.recentlyUsed || [],
        proxyStats: data.proxyStats || {},
        siteRules: data.siteRules || [],
        autoRotation: data.autoRotation || {},
        countryBlacklist: data.settings?.countryBlacklist || []
      }
    };
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proxymania-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    return { success: true, message: 'Backup exported successfully' };
  } catch (error) {
    console.error('Export backup failed:', error);
    return { success: false, error: error.message };
  }
}

// Import backup
async function importBackup(file) {
  try {
    const text = await file.text();
    const backup = JSON.parse(text);
    
    // Validate backup format
    if (!backup.version || !backup.data) {
      throw new Error('Invalid backup format');
    }
    
    // Check version compatibility
    if (backup.version !== BACKUP_VERSION) {
      console.warn(`Backup version ${backup.version} may not be fully compatible`);
    }
    
    // Merge or replace data
    const shouldMerge = confirm('Merge with existing data? (Cancel to replace)');
    
    if (shouldMerge) {
      await mergeBackupData(backup.data);
    } else {
      await replaceBackupData(backup.data);
    }
    
    return { 
      success: true, 
      message: 'Backup imported successfully',
      imported: {
        favorites: backup.data.favorites?.length || 0,
        settings: Object.keys(backup.data.settings || {}).length,
        stats: Object.keys(backup.data.proxyStats || {}).length
      }
    };
  } catch (error) {
    console.error('Import backup failed:', error);
    return { success: false, error: error.message };
  }
}

// Merge backup data with existing
async function mergeBackupData(data) {
  const existing = await chrome.storage.local.get(null);
  
  // Merge favorites (avoid duplicates)
  const existingFavs = existing.favorites || [];
  const newFavs = data.favorites || [];
  const mergedFavs = [...existingFavs];
  
  newFavs.forEach(fav => {
    if (!mergedFavs.some(f => f.ipPort === fav.ipPort)) {
      mergedFavs.push(fav);
    }
  });
  
  // Merge proxy stats
  const mergedStats = { ...existing.proxyStats, ...data.proxyStats };
  
  // Merge site rules
  const existingRules = existing.siteRules || [];
  const newRules = data.siteRules || [];
  const mergedRules = [...existingRules];
  
  newRules.forEach(rule => {
    if (!mergedRules.some(r => r.url === rule.url)) {
      mergedRules.push(rule);
    }
  });
  
  // Merge settings
  const mergedSettings = { ...existing.settings, ...data.settings };
  
  await chrome.storage.local.set({
    favorites: mergedFavs,
    proxyStats: mergedStats,
    siteRules: mergedRules,
    settings: mergedSettings,
    recentlyUsed: data.recentlyUsed || existing.recentlyUsed,
    autoRotation: data.autoRotation || existing.autoRotation
  });
}

// Replace all data with backup
async function replaceBackupData(data) {
  await chrome.storage.local.set({
    favorites: data.favorites || [],
    proxyStats: data.proxyStats || {},
    siteRules: data.siteRules || [],
    settings: data.settings || {},
    recentlyUsed: data.recentlyUsed || [],
    autoRotation: data.autoRotation || {}
  });
}

// Auto-backup (scheduled)
let autoBackupInterval = null;

function startAutoBackup(intervalMs = 24 * 60 * 60 * 1000) { // Default: 24 hours
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval);
  }
  
  autoBackupInterval = setInterval(async () => {
    try {
      const { settings } = await chrome.storage.local.get(['settings']);
      if (settings?.autoBackup !== false) {
        await exportBackup();
        console.log('Auto-backup completed');
      }
    } catch (error) {
      console.error('Auto-backup failed:', error);
    }
  }, intervalMs);
}

function stopAutoBackup() {
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval);
    autoBackupInterval = null;
  }
}

// Cloud sync support (Chrome sync)
async function syncToCloud() {
  try {
    const data = await chrome.storage.local.get(['settings', 'favorites', 'siteRules']);
    
    // Use chrome.storage.sync for cross-device sync
    await chrome.storage.sync.set({
      proxymania_sync: {
        timestamp: Date.now(),
        settings: data.settings,
        favorites: data.favorites,
        siteRules: data.siteRules
      }
    });
    
    return { success: true, message: 'Synced to cloud' };
  } catch (error) {
    console.error('Cloud sync failed:', error);
    return { success: false, error: error.message };
  }
}

async function syncFromCloud() {
  try {
    const data = await chrome.storage.sync.get(['proxymania_sync']);
    
    if (!data.proxymania_sync) {
      return { success: false, error: 'No cloud data found' };
    }
    
    const cloudData = data.proxymania_sync;
    
    // Check if cloud data is newer
    const localData = await chrome.storage.local.get(['settings']);
    const localTimestamp = localData.settings?.lastModified || 0;
    
    if (cloudData.timestamp > localTimestamp) {
      await chrome.storage.local.set({
        settings: cloudData.settings,
        favorites: cloudData.favorites,
        siteRules: cloudData.siteRules
      });
      
      return { success: true, message: 'Synced from cloud', data: cloudData };
    } else {
      return { success: true, message: 'Local data is up to date' };
    }
  } catch (error) {
    console.error('Cloud sync failed:', error);
    return { success: false, error: error.message };
  }
}

// Export for use in other modules
export {
  exportBackup,
  importBackup,
  startAutoBackup,
  stopAutoBackup,
  syncToCloud,
  syncFromCloud
};