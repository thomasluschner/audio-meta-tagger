import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { parseFile, IAudioMetadata } from 'music-metadata';
import * as NodeID3 from 'node-id3';
import axios from 'axios';
import * as cheerio from 'cheerio';
import Store from 'electron-store';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

interface AppSettings {
  beatportUsername?: string;
  beatportPassword?: string;
  bandcampUsername?: string;
  bandcampPassword?: string;
  overwriteExisting: boolean;
}

interface SearchResult {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  year?: number;
  label?: string;
  source: 'beatport' | 'bandcamp';
  url: string;
  confidence: number;
}

interface AudioFile {
  path: string;
  name: string;
  metadata?: IAudioMetadata;
  suggestedMetadata?: SearchResult[];
}

const store = new Store<AppSettings>({
  defaults: {
    overwriteExisting: false
  }
});

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    minHeight: 600,
    minWidth: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('select-audio-files', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Audio Files',
        extensions: ['mp3', 'flac', 'wav', 'aiff', 'aif']
      }
    ]
  });

  if (result.canceled) {
    return [];
  }

  const audioFiles: AudioFile[] = [];
  
  for (const filePath of result.filePaths) {
    try {
      const metadata = await parseFile(filePath);
      audioFiles.push({
        path: filePath,
        name: path.basename(filePath),
        metadata
      });
    } catch (error) {
      console.error(`Error reading metadata for ${filePath}:`, error);
      audioFiles.push({
        path: filePath,
        name: path.basename(filePath)
      });
    }
  }

  return audioFiles;
});

ipcMain.handle('get-settings', () => {
  return store.store;
});

ipcMain.handle('save-settings', (_, settings: AppSettings) => {
  store.set(settings);
  return true;
});

ipcMain.handle('search-metadata', async (_, fileName: string): Promise<SearchResult[]> => {
  const results: SearchResult[] = [];
  
  // Clean filename for search
  const searchQuery = cleanFileName(fileName);
  
  try {
    // Search Beatport
    const beatportResults = await searchBeatport(searchQuery);
    results.push(...beatportResults);
    
    // Search Bandcamp
    const bandcampResults = await searchBandcamp(searchQuery);
    results.push(...bandcampResults);
    
    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);
    
    return results.slice(0, 10); // Return top 10 results
  } catch (error) {
    console.error('Error searching metadata:', error);
    return [];
  }
});

ipcMain.handle('apply-metadata', async (_, filePath: string, metadata: SearchResult) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.mp3') {
      const tags = {
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album || '',
        genre: metadata.genre || '',
        year: metadata.year?.toString() || '',
        publisher: metadata.label || ''
      };
      
      const success = NodeID3.write(tags, filePath);
      return success;
    } else {
      // For other formats, we would need additional libraries
      // This is a simplified implementation
      console.log(`Metadata application for ${ext} files not yet implemented`);
      return false;
    }
  } catch (error) {
    console.error('Error applying metadata:', error);
    return false;
  }
});

ipcMain.handle('open-external', (_, url: string) => {
  shell.openExternal(url);
});

// Helper functions
function cleanFileName(fileName: string): string {
  // Remove file extension
  let cleaned = fileName.replace(/\.[^/.]+$/, '');
  
  // Remove common patterns
  cleaned = cleaned
    .replace(/^\d+[\s\-\.]*/, '') // Remove track numbers
    .replace(/[\[\(].*?[\]\)]/g, '') // Remove content in brackets/parentheses
    .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
  
  return cleaned;
}

async function searchBeatport(query: string): Promise<SearchResult[]> {
  try {
    const searchUrl = `https://www.beatport.com/search?q=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const results: SearchResult[] = [];
    
    $('.track').each((_, element) => {
      const $track = $(element);
      const title = $track.find('.track-title').text().trim();
      const artist = $track.find('.track-artists').text().trim();
      const label = $track.find('.track-label').text().trim();
      const genre = $track.find('.track-genre').text().trim();
      const url = $track.find('a').attr('href') || '';
      
      if (title && artist) {
        const confidence = calculateConfidence(query, `${artist} ${title}`);
        results.push({
          title,
          artist,
          label,
          genre,
          source: 'beatport',
          url: url.startsWith('http') ? url : `https://www.beatport.com${url}`,
          confidence
        });
      }
    });
    
    return results;
  } catch (error) {
    console.error('Beatport search error:', error);
    return [];
  }
}

async function searchBandcamp(query: string): Promise<SearchResult[]> {
  try {
    const searchUrl = `https://bandcamp.com/search?q=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const results: SearchResult[] = [];
    
    $('.searchresult').each((_, element) => {
      const $result = $(element);
      const title = $result.find('.heading').text().trim();
      const artist = $result.find('.subhead').text().trim();
      const url = $result.find('.itemurl').text().trim();
      
      if (title && artist) {
        const confidence = calculateConfidence(query, `${artist} ${title}`);
        results.push({
          title,
          artist,
          source: 'bandcamp',
          url,
          confidence
        });
      }
    });
    
    return results;
  } catch (error) {
    console.error('Bandcamp search error:', error);
    return [];
  }
}

function calculateConfidence(query: string, result: string): number {
  const queryWords = query.toLowerCase().split(/\s+/);
  const resultWords = result.toLowerCase().split(/\s+/);
  
  let matches = 0;
  for (const queryWord of queryWords) {
    for (const resultWord of resultWords) {
      if (resultWord.includes(queryWord) || queryWord.includes(resultWord)) {
        matches++;
        break;
      }
    }
  }
  
  return (matches / queryWords.length) * 100;
}