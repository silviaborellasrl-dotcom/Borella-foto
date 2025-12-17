=== Photo Renamer ===
Contributors: borellacasalinghi
Tags: photo, rename, excel, images, batch, shortcode, elementor
Requires at least: 5.0
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Rinomina automaticamente le foto prendendo i dati dal file Excel. Include shortcode per integrazione con Elementor.

== Description ==

Photo Renamer è un plugin WordPress che permette di rinominare automaticamente le foto dei prodotti 
utilizzando i codici definiti in un file Excel.

**NOVITÀ v1.1: Shortcode per Elementor!**

Usa lo shortcode `[photo_renamer]` per integrare lo strumento in qualsiasi pagina del tuo sito.

**Funzionalità principali:**

* Caricamento automatico delle mappature dal file Excel remoto
* Upload multiplo delle immagini tramite drag & drop
* Rinominazione automatica basata su CODICE → COD PRODOTTO
* Download delle foto rinominate in un archivio ZIP
* Controllo automatico degli aggiornamenti del file Excel
* Ricerca rapida nella tabella delle mappature
* **Shortcode per integrazione frontend**
* **Compatibile con Elementor, Gutenberg e qualsiasi page builder**

**Formati supportati:**
* JPG / JPEG
* PNG
* WEBP

== Installation ==

1. Carica la cartella `photo-renamer` nella directory `/wp-content/plugins/`
2. Attiva il plugin attraverso il menu 'Plugin' in WordPress
3. Vai su "Photo Renamer" nel menu amministrazione per l'interfaccia admin
4. Usa lo shortcode `[photo_renamer]` in qualsiasi pagina per il frontend

== Shortcode ==

**Uso base:**
`[photo_renamer]`

**Parametri disponibili:**

* `title` - Titolo personalizzato (default: "Photo Renamer")
* `show_table` - Mostra la tabella mappature: "yes" o "no" (default: "yes")
* `show_search` - Mostra la ricerca: "yes" o "no" (default: "yes")

**Esempi:**

`[photo_renamer title="Rinomina le tue foto"]`

`[photo_renamer show_table="no"]`

`[photo_renamer title="Strumento Rinomina" show_search="no"]`

== Integrazione con Elementor ==

1. Crea una nuova pagina o modifica una esistente
2. Aggiungi un widget "Shortcode" o "HTML"
3. Inserisci: `[photo_renamer]`
4. Salva e visualizza la pagina

== Frequently Asked Questions ==

= Come funziona la rinominazione? =

Il plugin legge il file Excel che contiene due colonne:
- Colonna A (CODICE): Il nome del file originale (senza estensione)
- Colonna B (COD PRODOTTO): Il nuovo nome da assegnare al file

= Posso usare lo shortcode in qualsiasi pagina? =

Sì! Lo shortcode funziona con qualsiasi page builder (Elementor, Gutenberg, Divi, etc.).

= Gli utenti devono essere loggati per usare lo strumento? =

No, lo shortcode funziona anche per utenti non loggati (visitatori).

= Come personalizzo l'aspetto? =

Puoi aggiungere CSS personalizzato nel customizer di WordPress. 
Tutte le classi CSS iniziano con `.pr-` per evitare conflitti.

== Changelog ==

= 1.1.0 =
* Aggiunto shortcode [photo_renamer] per integrazione frontend
* Compatibilità con Elementor e altri page builder
* Nuovo design responsive per mobile
* Supporto per utenti non loggati

= 1.0.0 =
* Prima versione del plugin
* Caricamento automatico mappature da Excel
* Upload drag & drop
* Download ZIP
* Controllo aggiornamenti automatico

== Upgrade Notice ==

= 1.1.0 =
Nuova versione con shortcode per integrazione frontend!
