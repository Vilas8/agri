/**
 * Dataset Integration Module
 * Handles data synchronization and storage for AgriPredict
 * This file is loaded alongside script.js to provide data management functionality
 */

// Dataset Integration Handler
const datasetIntegration = {
  // Initialize dataset integration
  init: async function() {
    console.log('Dataset integration initialized');
    return { isOk: true };
  },
  
  // Get all data from localStorage
  getAllData: function() {
    try {
      const data = localStorage.getItem('agripredict_data');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error getting data:', e);
      return [];
    }
  },
  
  // Save data to localStorage
  saveData: function(data) {
    try {
      localStorage.setItem('agripredict_data', JSON.stringify(data));
      return { isOk: true };
    } catch (e) {
      console.error('Error saving data:', e);
      return { isOk: false, error: e.message };
    }
  },
  
  // Clear all data
  clearData: function() {
    try {
      localStorage.removeItem('agripredict_data');
      return { isOk: true };
    } catch (e) {
      console.error('Error clearing data:', e);
      return { isOk: false, error: e.message };
    }
  },
  
  // Export data as JSON
  exportData: function() {
    const data = this.getAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agripredict_data_' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    return { isOk: true };
  },
  
  // Import data from JSON file
  importData: function(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          this.saveData(data);
          resolve({ isOk: true, count: Array.isArray(data) ? data.length : 0 });
        } catch (err) {
          resolve({ isOk: false, error: 'Invalid JSON file' });
        }
      };
      reader.readAsText(file);
    });
  }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    datasetIntegration.init();
  });
} else {
  datasetIntegration.init();
}

// Export for use in other scripts
window.datasetIntegration = datasetIntegration;

