"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const music_metadata_1 = require("music-metadata");
const NodeID3 = __importStar(require("node-id3"));
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const electron_store_1 = __importDefault(require("electron-store"));
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    electron_1.app.quit();
}
const store = new electron_store_1.default({
    defaults: {
        overwriteExisting: false
    }
});
const createWindow = () => {
    const mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
        mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }
    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
};
electron_1.app.on('ready', createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// IPC Handlers
electron_1.ipcMain.handle('select-audio-files', async () => {
    const result = await electron_1.dialog.showOpenDialog({
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
    const audioFiles = [];
    for (const filePath of result.filePaths) {
        try {
            const metadata = await (0, music_metadata_1.parseFile)(filePath);
            audioFiles.push({
                path: filePath,
                name: path.basename(filePath),
                metadata
            });
        }
        catch (error) {
            console.error(`Error reading metadata for ${filePath}:`, error);
            audioFiles.push({
                path: filePath,
                name: path.basename(filePath)
            });
        }
    }
    return audioFiles;
});
electron_1.ipcMain.handle('get-settings', () => {
    return store.store;
});
electron_1.ipcMain.handle('save-settings', (_, settings) => {
    store.set(settings);
    return true;
});
electron_1.ipcMain.handle('search-metadata', async (_, fileName) => {
    const results = [];
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
    }
    catch (error) {
        console.error('Error searching metadata:', error);
        return [];
    }
});
electron_1.ipcMain.handle('apply-metadata', async (_, filePath, metadata) => {
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
        }
        else {
            // For other formats, we would need additional libraries
            // This is a simplified implementation
            console.log(`Metadata application for ${ext} files not yet implemented`);
            return false;
        }
    }
    catch (error) {
        console.error('Error applying metadata:', error);
        return false;
    }
});
electron_1.ipcMain.handle('open-external', (_, url) => {
    electron_1.shell.openExternal(url);
});
// Helper functions
function cleanFileName(fileName) {
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
async function searchBeatport(query) {
    try {
        const searchUrl = `https://www.beatport.com/search?q=${encodeURIComponent(query)}`;
        const response = await axios_1.default.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(response.data);
        const results = [];
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
    }
    catch (error) {
        console.error('Beatport search error:', error);
        return [];
    }
}
async function searchBandcamp(query) {
    try {
        const searchUrl = `https://bandcamp.com/search?q=${encodeURIComponent(query)}`;
        const response = await axios_1.default.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(response.data);
        const results = [];
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
    }
    catch (error) {
        console.error('Bandcamp search error:', error);
        return [];
    }
}
function calculateConfidence(query, result) {
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
//# sourceMappingURL=main.js.map