# Photo Renamer - Sistema Rinomina Automatica Foto

## Problema Originale
Creare un sistema che possa rinominare le foto in automatico prendendo i dati da una colonna Excel.

## Requisiti Utente
- File Excel caricato automaticamente da: https://www.borellacasalinghi.it/foto-prodotti/cartella-immagini/CODICI PRODOTTI.xlsx
- Colonna A = CODICE (nome file originale)
- Colonna B = COD PRODOTTO (nuovo nome per la foto)
- Formati supportati: JPG, JPEG, PNG, WEBP
- Upload foto: drag & drop + selezione da PC
- Download finale: archivio ZIP
- Tema: chiaro

## Architettura Implementata

### Backend (FastAPI)
- `GET /api/` - Health check
- `GET /api/excel-mapping` - Carica mappature da Excel remoto (911 righe)
- `POST /api/process-images` - Processa immagini e le rinomina
- `GET /api/download-zip/{session_id}` - Download ZIP con immagini rinominate

### Frontend (React)
- Interfaccia tema chiaro
- Zona upload immagini (drag & drop + click)
- Tabella mappature Excel con ricerca
- Visualizzazione risultati
- Download ZIP

### Database (MongoDB)
- Collezione `excel_mappings` - Cache mappature Excel
- Collezione `temp_files` - File temporanei per download ZIP

## Flusso Applicazione
1. App carica automaticamente le 911 mappature dal file Excel remoto
2. Utente carica le foto (drag & drop o selezione)
3. Sistema abbina nome file con CODICE → rinomina con COD PRODOTTO
4. Genera ZIP con foto rinominate → download

## Funzionalità Implementate
- ✅ Controllo automatico aggiornamenti Excel all'avvio
- ✅ Verifica hash MD5 per rilevare modifiche al file
- ✅ Pulsante "Controlla Aggiornamenti" per verifica manuale
- ✅ Visualizzazione data/ora ultimo aggiornamento
- ✅ Cache intelligente delle mappature in MongoDB

## Prossimi Miglioramenti Suggeriti
1. **Cronologia elaborazioni**: Salvare le elaborazioni per consultazione futura
2. **Preview immagini**: Mostrare anteprima delle foto prima dell'elaborazione
3. **Batch processing**: Gestire grandi quantità di foto con progress dettagliato
4. **Report PDF**: Generare report delle rinominazioni effettuate
5. **Notifica automatica**: Alert quando vengono rilevati nuovi codici nel file Excel
