=== Photo Renamer ===
Contributors: borellacasalinghi
Tags: photo, rename, excel, images, batch
Requires at least: 5.0
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Rinomina automaticamente le foto prendendo i dati dal file Excel CODICI PRODOTTI.xlsx

== Description ==

Photo Renamer è un plugin WordPress che permette di rinominare automaticamente le foto dei prodotti 
utilizzando i codici definiti in un file Excel.

**Funzionalità principali:**

* Caricamento automatico delle mappature dal file Excel remoto
* Upload multiplo delle immagini tramite drag & drop
* Rinominazione automatica basata su CODICE → COD PRODOTTO
* Download delle foto rinominate in un archivio ZIP
* Controllo automatico degli aggiornamenti del file Excel
* Ricerca rapida nella tabella delle mappature

**Formati supportati:**
* JPG / JPEG
* PNG
* WEBP

== Installation ==

1. Carica la cartella `photo-renamer` nella directory `/wp-content/plugins/`
2. Attiva il plugin attraverso il menu 'Plugin' in WordPress
3. Vai su "Photo Renamer" nel menu amministrazione
4. Il plugin caricherà automaticamente le mappature dal file Excel

== Frequently Asked Questions ==

= Come funziona la rinominazione? =

Il plugin legge il file Excel che contiene due colonne:
- Colonna A (CODICE): Il nome del file originale (senza estensione)
- Colonna B (COD PRODOTTO): Il nuovo nome da assegnare al file

Quando carichi un'immagine chiamata "1675.jpg", il plugin cerca "1675" nella colonna CODICE 
e rinomina il file con il valore corrispondente nella colonna COD PRODOTTO (es: "8032958900042.jpg").

= Come posso aggiornare le mappature? =

Clicca il pulsante "Controlla Aggiornamenti" nell'header. Il plugin verificherà se il file Excel 
è stato modificato e aggiornerà automaticamente le mappature.

= Cosa succede se un codice non viene trovato? =

Se il nome del file non corrisponde a nessun CODICE nel file Excel, il file verrà segnalato 
come "errore" nei risultati e non verrà incluso nel download ZIP.

== Changelog ==

= 1.0.0 =
* Prima versione del plugin
* Caricamento automatico mappature da Excel
* Upload drag & drop
* Download ZIP
* Controllo aggiornamenti automatico

== Upgrade Notice ==

= 1.0.0 =
Prima release del plugin.
