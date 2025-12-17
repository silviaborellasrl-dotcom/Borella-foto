<?php
/**
 * Shortcode Template - Frontend Display
 */

if (!defined('ABSPATH')) {
    exit;
}
?>
<div class="pr-container" id="photo-renamer-app">
    <!-- Header -->
    <div class="pr-header">
        <div class="pr-logo">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
        </div>
        <div class="pr-title">
            <h2><?php echo esc_html($atts['title']); ?></h2>
            <p><?php _e('Rinomina automatica foto da Excel', 'photo-renamer'); ?></p>
        </div>
        <?php if ($total_mappings > 0): ?>
        <div class="pr-badge pr-badge-success">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span><?php printf(__('%d mappature', 'photo-renamer'), $total_mappings); ?></span>
        </div>
        <?php endif; ?>
    </div>

    <div class="pr-content">
        <!-- Left Column -->
        <div class="pr-left">
            <!-- Upload Card -->
            <div class="pr-card">
                <div class="pr-card-header">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <h3><?php _e('Carica Immagini', 'photo-renamer'); ?></h3>
                </div>
                <div class="pr-card-body">
                    <div id="pr-dropzone" class="pr-dropzone">
                        <input type="file" id="pr-file-input" multiple accept=".jpg,.jpeg,.png,.webp,image/*" />
                        <div class="pr-dropzone-content">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                            <p class="pr-dropzone-title"><?php _e('Trascina le immagini qui', 'photo-renamer'); ?></p>
                            <p class="pr-dropzone-subtitle"><?php _e('oppure clicca per selezionare', 'photo-renamer'); ?></p>
                            <span class="pr-dropzone-formats">JPG, JPEG, PNG, WEBP</span>
                        </div>
                    </div>

                    <!-- File List -->
                    <div id="pr-file-list" class="pr-file-list" style="display: none;">
                        <div class="pr-file-list-header">
                            <span id="pr-file-count">0 <?php _e('file selezionati', 'photo-renamer'); ?></span>
                            <button type="button" id="pr-btn-clear" class="pr-btn-link">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                                <?php _e('Rimuovi tutti', 'photo-renamer'); ?>
                            </button>
                        </div>
                        <div id="pr-file-items" class="pr-file-items"></div>
                    </div>
                </div>
            </div>

            <!-- Progress -->
            <div id="pr-progress" class="pr-card pr-progress-card" style="display: none;">
                <div class="pr-card-body">
                    <div class="pr-progress-info">
                        <span id="pr-progress-text"><?php _e('Elaborazione in corso...', 'photo-renamer'); ?></span>
                        <span id="pr-progress-percent">0%</span>
                    </div>
                    <div class="pr-progress-bar">
                        <div id="pr-progress-fill" class="pr-progress-fill"></div>
                    </div>
                </div>
            </div>

            <!-- Buttons -->
            <div class="pr-actions">
                <button type="button" id="pr-btn-process" class="pr-btn pr-btn-primary" disabled>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                    <?php _e('Rinomina Foto', 'photo-renamer'); ?>
                </button>
                <button type="button" id="pr-btn-download" class="pr-btn pr-btn-success" style="display: none;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <?php _e('Scarica ZIP', 'photo-renamer'); ?>
                </button>
            </div>

            <!-- Results -->
            <div id="pr-results" class="pr-card" style="display: none;">
                <div class="pr-card-header">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                    <h3><?php _e('Risultati', 'photo-renamer'); ?></h3>
                </div>
                <div class="pr-card-body">
                    <div class="pr-results-summary">
                        <div class="pr-result-box pr-result-success">
                            <span id="pr-success-count" class="pr-result-number">0</span>
                            <span class="pr-result-label"><?php _e('Successi', 'photo-renamer'); ?></span>
                        </div>
                        <div class="pr-result-box pr-result-error">
                            <span id="pr-error-count" class="pr-result-number">0</span>
                            <span class="pr-result-label"><?php _e('Errori', 'photo-renamer'); ?></span>
                        </div>
                    </div>
                    <div id="pr-results-list" class="pr-results-list"></div>
                </div>
            </div>
        </div>

        <!-- Right Column - Mappings Table -->
        <?php if ($atts['show_table'] === 'yes'): ?>
        <div class="pr-right">
            <div class="pr-card pr-card-table">
                <div class="pr-card-header">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 3h18v18H3zM21 9H3M21 15H3M12 3v18"></path>
                    </svg>
                    <h3>
                        <?php _e('Mappatura Excel', 'photo-renamer'); ?>
                        <span class="pr-badge-small"><?php echo $total_mappings; ?> <?php _e('righe', 'photo-renamer'); ?></span>
                    </h3>
                </div>
                <div class="pr-card-body">
                    <?php if ($last_update): ?>
                    <div class="pr-excel-status">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span><?php _e('Ultimo aggiornamento:', 'photo-renamer'); ?> <?php echo date_i18n('d/m/Y H:i', strtotime($last_update)); ?></span>
                    </div>
                    <?php endif; ?>

                    <?php if ($atts['show_search'] === 'yes'): ?>
                    <div class="pr-search">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input type="text" id="pr-search" placeholder="<?php _e('Cerca codice...', 'photo-renamer'); ?>" />
                    </div>
                    <?php endif; ?>

                    <div class="pr-table-container">
                        <?php if ($total_mappings > 0): ?>
                        <table class="pr-table">
                            <thead>
                                <tr>
                                    <th><?php _e('Codice (Nome File)', 'photo-renamer'); ?></th>
                                    <th><?php _e('Cod Prodotto (Nuovo Nome)', 'photo-renamer'); ?></th>
                                </tr>
                            </thead>
                            <tbody id="pr-mappings-tbody">
                                <?php 
                                $mappings = $this->excel_parser->get_mappings();
                                foreach ($mappings as $codice => $cod_prodotto): 
                                ?>
                                <tr data-codice="<?php echo esc_attr(strtolower($codice)); ?>" data-prodotto="<?php echo esc_attr(strtolower($cod_prodotto)); ?>">
                                    <td><?php echo esc_html($codice); ?></td>
                                    <td class="pr-cod-prodotto"><?php echo esc_html($cod_prodotto); ?></td>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                        <?php else: ?>
                        <div class="pr-no-data">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            <p><?php _e('Nessuna mappatura disponibile', 'photo-renamer'); ?></p>
                        </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        </div>
        <?php endif; ?>
    </div>

    <!-- Toast Notification -->
    <div id="pr-toast" class="pr-toast"></div>
</div>
