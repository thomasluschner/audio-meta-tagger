# Audio Metadata Manager

Eine native macOS-App zur automatischen Ergänzung von Audio-Metadaten aus Beatport und Bandcamp.

## Features

- 🎵 Unterstützung für MP3, FLAC, WAV und AIFF Dateien
- 🔍 Automatische Suche auf Beatport und Bandcamp
- 🎯 Intelligente Dateinamen-Analyse
- ⚡ Automatische Anwendung bei eindeutigen Treffern
- 🎛️ Benutzerauswahl bei mehreren Ergebnissen
- 🔧 Konfigurierbare Einstellungen
- 🖱️ Drag & Drop Unterstützung
- 🎨 Native macOS Design

## Installation

1. Abhängigkeiten installieren:
```bash
npm install
```

2. App starten (Development):
```bash
npm start
```

3. App bauen:
```bash
npm run make
```

## Verwendung

1. **Dateien auswählen**: Klicken Sie auf "Select Audio Files" oder ziehen Sie Dateien in die App
2. **Automatische Suche**: Die App sucht automatisch nach Metadaten basierend auf dem Dateinamen
3. **Ergebnisse prüfen**: Bei mehreren Treffern können Sie das beste Ergebnis auswählen
4. **Metadaten anwenden**: Klicken Sie auf "Apply" um die Metadaten zu übernehmen

## Einstellungen

- **Bestehende Metadaten überschreiben**: Aktivieren Sie diese Option, um vorhandene Metadaten zu ersetzen
- **Account-Daten**: Geben Sie optional Ihre Beatport/Bandcamp Zugangsdaten ein für bessere Suchergebnisse

## Technische Details

- **Framework**: Electron mit TypeScript
- **Metadaten-Verarbeitung**: music-metadata, node-id3
- **Web-Scraping**: Cheerio, Axios
- **UI**: Native CSS mit macOS Design System
- **Persistierung**: electron-store

## Unterstützte Formate

- **MP3**: Vollständige Metadaten-Unterstützung
- **FLAC**: Lesezugriff (Schreibzugriff in Entwicklung)
- **WAV**: Lesezugriff (Schreibzugriff in Entwicklung)
- **AIFF**: Lesezugriff (Schreibzugriff in Entwicklung)

## Entwicklung

```bash
# Development starten
npm start

# TypeScript kompilieren
npm run build

# Linting
npm run lint

# App paketieren
npm run package

# Installer erstellen
npm run make
```

## Lizenz

MIT License