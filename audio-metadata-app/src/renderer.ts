import './index.css';

interface AudioFile {
  path: string;
  name: string;
  metadata?: any;
  suggestedMetadata?: any[];
  processing?: boolean;
}

interface AppSettings {
  beatportUsername?: string;
  beatportPassword?: string;
  bandcampUsername?: string;
  bandcampPassword?: string;
  overwriteExisting: boolean;
}

class AudioMetadataApp {
  private audioFiles: AudioFile[] = [];
  private settings: AppSettings = { overwriteExisting: false };
  private currentView: 'main' | 'settings' = 'main';

  constructor() {
    this.init();
  }

  private async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.renderMainView();
  }

  private async loadSettings() {
    try {
      this.settings = await window.electronAPI.getSettings();
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  private async saveSettings() {
    try {
      await window.electronAPI.saveSettings(this.settings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  private setupEventListeners() {
    // Navigation
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      if (target.matches('[data-action="show-settings"]')) {
        this.showSettings();
      } else if (target.matches('[data-action="show-main"]')) {
        this.showMain();
      } else if (target.matches('[data-action="select-files"]')) {
        this.selectFiles();
      } else if (target.matches('[data-action="process-all"]')) {
        this.processAllFiles();
      } else if (target.matches('[data-action="save-settings"]')) {
        this.handleSaveSettings();
      } else if (target.matches('[data-action="apply-metadata"]')) {
        const fileIndex = parseInt(target.dataset.fileIndex || '0');
        const resultIndex = parseInt(target.dataset.resultIndex || '0');
        this.applyMetadata(fileIndex, resultIndex);
      } else if (target.matches('[data-action="open-url"]')) {
        const url = target.dataset.url;
        if (url) {
          window.electronAPI.openExternal(url);
        }
      }
    });

    // Settings form changes
    document.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      
      if (target.matches('[data-setting]')) {
        const setting = target.dataset.setting as keyof AppSettings;
        if (target.type === 'checkbox') {
          (this.settings as any)[setting] = target.checked;
        } else {
          (this.settings as any)[setting] = target.value;
        }
      }
    });

    // Drag and drop
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      document.body.classList.add('drag-over');
    });

    document.addEventListener('dragleave', (e) => {
      if (!document.body.contains(e.relatedTarget as Node)) {
        document.body.classList.remove('drag-over');
      }
    });

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      document.body.classList.remove('drag-over');
      
      const files = Array.from(e.dataTransfer?.files || []);
      const audioFiles = files.filter(file => 
        /\.(mp3|flac|wav|aiff|aif)$/i.test(file.name)
      );
      
      if (audioFiles.length > 0) {
        this.handleDroppedFiles(audioFiles);
      }
    });
  }

  private async handleDroppedFiles(files: File[]) {
    for (const file of files) {
      const audioFile: AudioFile = {
        path: (file as any).path || file.name,
        name: file.name,
        processing: false
      };
      
      this.audioFiles.push(audioFile);
    }
    
    this.renderMainView();
  }

  private async selectFiles() {
    try {
      const files = await window.electronAPI.selectAudioFiles();
      this.audioFiles = files.map(file => ({
        ...file,
        processing: false
      }));
      this.renderMainView();
    } catch (error) {
      console.error('Error selecting files:', error);
    }
  }

  private async processAllFiles() {
    for (let i = 0; i < this.audioFiles.length; i++) {
      await this.processFile(i);
    }
  }

  private async processFile(index: number) {
    const file = this.audioFiles[index];
    if (!file || file.processing) return;

    file.processing = true;
    this.renderMainView();

    try {
      const results = await window.electronAPI.searchMetadata(file.name);
      file.suggestedMetadata = results;
      
      // Auto-apply if there's a high-confidence single result
      if (results.length === 1 && results[0].confidence > 80) {
        await this.applyMetadata(index, 0);
      }
    } catch (error) {
      console.error('Error processing file:', error);
    } finally {
      file.processing = false;
      this.renderMainView();
    }
  }

  private async applyMetadata(fileIndex: number, resultIndex: number) {
    const file = this.audioFiles[fileIndex];
    const metadata = file.suggestedMetadata?.[resultIndex];
    
    if (!file || !metadata) return;

    try {
      const success = await window.electronAPI.applyMetadata(file.path, metadata);
      if (success) {
        // Update UI to show success
        this.showNotification(`Metadata applied to ${file.name}`, 'success');
      } else {
        this.showNotification(`Failed to apply metadata to ${file.name}`, 'error');
      }
    } catch (error) {
      console.error('Error applying metadata:', error);
      this.showNotification(`Error applying metadata to ${file.name}`, 'error');
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  private showSettings() {
    this.currentView = 'settings';
    this.renderSettingsView();
  }

  private showMain() {
    this.currentView = 'main';
    this.renderMainView();
  }

  private async handleSaveSettings() {
    await this.saveSettings();
    this.showNotification('Settings saved successfully', 'success');
  }

  private renderMainView() {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = `
      <div class="app-container">
        <header class="app-header">
          <h1>Audio Metadata Manager</h1>
          <div class="header-actions">
            <button class="btn btn-secondary" data-action="show-settings">
              <span class="icon">⚙️</span>
              Settings
            </button>
          </div>
        </header>

        <main class="app-main">
          ${this.audioFiles.length === 0 ? this.renderEmptyState() : this.renderFileList()}
        </main>

        ${this.audioFiles.length > 0 ? this.renderActionBar() : ''}
      </div>
    `;
  }

  private renderEmptyState() {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">🎵</div>
        <h2>No audio files selected</h2>
        <p>Select audio files to automatically enhance their metadata</p>
        <button class="btn btn-primary" data-action="select-files">
          Select Audio Files
        </button>
        <div class="drop-zone">
          <p>Or drag and drop audio files here</p>
          <small>Supports MP3, FLAC, WAV, and AIFF files</small>
        </div>
      </div>
    `;
  }

  private renderFileList() {
    return `
      <div class="file-list">
        ${this.audioFiles.map((file, index) => this.renderFileItem(file, index)).join('')}
      </div>
    `;
  }

  private renderFileItem(file: AudioFile, index: number) {
    return `
      <div class="file-item ${file.processing ? 'processing' : ''}">
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-path">${file.path}</div>
          ${file.processing ? '<div class="processing-indicator">Searching metadata...</div>' : ''}
        </div>
        
        ${file.suggestedMetadata && file.suggestedMetadata.length > 0 ? `
          <div class="metadata-suggestions">
            <h4>Suggested Metadata:</h4>
            ${file.suggestedMetadata.map((result, resultIndex) => `
              <div class="metadata-result">
                <div class="result-info">
                  <div class="result-title">${result.title}</div>
                  <div class="result-artist">${result.artist}</div>
                  ${result.album ? `<div class="result-album">${result.album}</div>` : ''}
                  ${result.genre ? `<div class="result-genre">${result.genre}</div>` : ''}
                  <div class="result-source">
                    Source: ${result.source} 
                    <span class="confidence">(${Math.round(result.confidence)}% match)</span>
                  </div>
                </div>
                <div class="result-actions">
                  <button class="btn btn-sm btn-primary" 
                          data-action="apply-metadata" 
                          data-file-index="${index}" 
                          data-result-index="${resultIndex}">
                    Apply
                  </button>
                  <button class="btn btn-sm btn-secondary" 
                          data-action="open-url" 
                          data-url="${result.url}">
                    View
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderActionBar() {
    return `
      <div class="action-bar">
        <button class="btn btn-secondary" data-action="select-files">
          Add More Files
        </button>
        <button class="btn btn-primary" data-action="process-all">
          Process All Files
        </button>
      </div>
    `;
  }

  private renderSettingsView() {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = `
      <div class="app-container">
        <header class="app-header">
          <button class="btn btn-secondary" data-action="show-main">
            <span class="icon">←</span>
            Back
          </button>
          <h1>Settings</h1>
        </header>

        <main class="app-main">
          <div class="settings-form">
            <section class="settings-section">
              <h3>General Settings</h3>
              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" 
                         data-setting="overwriteExisting" 
                         ${this.settings.overwriteExisting ? 'checked' : ''}>
                  <span class="checkmark"></span>
                  Overwrite existing metadata
                </label>
                <small>When enabled, existing metadata will be replaced with new data</small>
              </div>
            </section>

            <section class="settings-section">
              <h3>Beatport Account (Optional)</h3>
              <div class="form-group">
                <label for="beatport-username">Username:</label>
                <input type="text" 
                       id="beatport-username" 
                       data-setting="beatportUsername" 
                       value="${this.settings.beatportUsername || ''}"
                       placeholder="Your Beatport username">
              </div>
              <div class="form-group">
                <label for="beatport-password">Password:</label>
                <input type="password" 
                       id="beatport-password" 
                       data-setting="beatportPassword" 
                       value="${this.settings.beatportPassword || ''}"
                       placeholder="Your Beatport password">
              </div>
              <small>Account credentials may improve search results and access to premium content</small>
            </section>

            <section class="settings-section">
              <h3>Bandcamp Account (Optional)</h3>
              <div class="form-group">
                <label for="bandcamp-username">Username:</label>
                <input type="text" 
                       id="bandcamp-username" 
                       data-setting="bandcampUsername" 
                       value="${this.settings.bandcampUsername || ''}"
                       placeholder="Your Bandcamp username">
              </div>
              <div class="form-group">
                <label for="bandcamp-password">Password:</label>
                <input type="password" 
                       id="bandcamp-password" 
                       data-setting="bandcampPassword" 
                       value="${this.settings.bandcampPassword || ''}"
                       placeholder="Your Bandcamp password">
              </div>
              <small>Account credentials may improve search results and access to your collection</small>
            </section>

            <div class="settings-actions">
              <button class="btn btn-primary" data-action="save-settings">
                Save Settings
              </button>
            </div>
          </div>
        </main>
      </div>
    `;
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AudioMetadataApp();
});

// Global type declaration
declare global {
  interface Window {
    electronAPI: {
      selectAudioFiles: () => Promise<any[]>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<boolean>;
      searchMetadata: (fileName: string) => Promise<any[]>;
      applyMetadata: (filePath: string, metadata: any) => Promise<boolean>;
      openExternal: (url: string) => Promise<void>;
    };
  }
}