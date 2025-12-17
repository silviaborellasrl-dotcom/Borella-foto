<?php
/**
 * Admin Page Template
 */

if (!defined('ABSPATH')) {
    exit;
}
?>
<div class="wrap photo-renamer-wrap">
    <div class="photo-renamer-header">
        <div class="photo-renamer-logo">
            <span class="dashicons dashicons-images-alt2"></span>
        </div>
        <div class="photo-renamer-title">
            <h1><?php _e('Photo Renamer', 'photo-renamer'); ?></h1>
            <p><?php _e('Rinomina automatica foto da Excel', 'photo-renamer'); ?></p>
        </div>
        <div class="photo-renamer-status">
            <?php if ($total_mappings > 0): ?>
                <span class="status-badge status-success">
                    <span class="dashicons dashicons-yes-alt"></span>
                    <?php printf(__('%d mappature', 'photo-renamer'), $total_mappings); ?>
                </span>
            <?php else: ?>
                <span class="status-badge status-warning">
                    <span class="dashicons dashicons-warning"></span>
                    <?php _e('Nessuna mappatura', 'photo-renamer'); ?>
                </span>
            <?php endif; ?>
            <button type="button" id="btn-check-update" class="button">
                <span class="dashicons dashicons-update"></span>
                <?php _e('Controlla Aggiornamenti', 'photo-renamer'); ?>
            </button>
        </div>
    </div>
    
    <div class="photo-renamer-container">
        <div class="photo-renamer-left">
            <!-- Upload Zone -->
            <div class="photo-renamer-card">
                <div class="card-header">
                    <span class="dashicons dashicons-upload"></span>
                    <h2><?php _e('Carica Immagini', 'photo-renamer'); ?></h2>
                </div>
                <div class="card-body">
                    <div id="dropzone" class="dropzone">
                        <input type="file" id="file-input" multiple accept=".jpg,.jpeg,.png,.webp,image/*" />
                        <div class="dropzone-content">
                            <span class="dashicons dashicons-format-image"></span>
                            <p><?php _e('Trascina le immagini qui', 'photo-renamer'); ?></p>
                            <p class="dropzone-subtitle"><?php _e('oppure clicca per selezionare', 'photo-renamer'); ?></p>
                            <span class="dropzone-formats">JPG, JPEG, PNG, WEBP</span>
                        </div>
                    </div>
                    
                    <!-- File List -->
                    <div id="file-list" class="file-list" style="display: none;">
                        <div class="file-list-header">
                            <span id="file-count">0 file selezionati</span>
                            <button type="button" id="btn-clear-files" class="button-link">
                                <span class="dashicons dashicons-trash"></span>
                                <?php _e('Rimuovi tutti', 'photo-renamer'); ?>
                            </button>
                        </div>
                        <div id="file-items" class="file-items"></div>
                    </div>
                </div>
            </div>
            
            <!-- Progress -->
            <div id="progress-container" class="photo-renamer-card" style="display: none;">
                <div class="card-body">
                    <div class="progress-info">
                        <span id="progress-text"><?php _e('Elaborazione in corso...', 'photo-renamer'); ?></span>
                        <span id="progress-percent">0%</span>
                    </div>
                    <div class="progress-bar">
                        <div id="progress-fill" class="progress-fill"></div>
                    </div>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="photo-renamer-actions">
                <button type="button" id="btn-process" class="button button-primary button-hero" disabled>
                    <span class="dashicons dashicons-superhero"></span>
                    <?php _e('Rinomina Foto', 'photo-renamer'); ?>
                </button>
                <button type="button" id="btn-download" class="button button-secondary button-hero" style="display: none;">
                    <span class="dashicons dashicons-download"></span>
                    <?php _e('Scarica ZIP', 'photo-renamer'); ?>
                </button>
            </div>
            
            <!-- Results -->
            <div id="results-container" class="photo-renamer-card" style="display: none;">
                <div class="card-header">
                    <span class="dashicons dashicons-analytics"></span>
                    <h2><?php _e('Risultati', 'photo-renamer'); ?></h2>
                </div>
                <div class="card-body">
                    <div class="results-summary">
                        <div class="result-box result-success">
                            <span id="success-count" class="result-number">0</span>
                            <span class="result-label"><?php _e('Successi', 'photo-renamer'); ?></span>
                        </div>
                        <div class="result-box result-error">
                            <span id="error-count" class="result-number">0</span>
                            <span class="result-label"><?php _e('Errori', 'photo-renamer'); ?></span>
                        </div>
                    </div>
                    <div id="results-list" class="results-list"></div>
                </div>
            </div>
        </div>
        
        <div class="photo-renamer-right">
            <!-- Mappings Table -->
            <div class="photo-renamer-card">
                <div class="card-header">
                    <span class="dashicons dashicons-editor-table"></span>
                    <h2>
                        <?php _e('Mappatura Excel', 'photo-renamer'); ?>
                        <span class="badge"><?php echo $total_mappings; ?> <?php _e('righe', 'photo-renamer'); ?></span>
                    </h2>
                </div>
                <div class="card-body">
                    <!-- Excel Status -->
                    <div class="excel-status">
                        <span class="dashicons dashicons-clock"></span>
                        <span>
                            <?php _e('Ultimo aggiornamento:', 'photo-renamer'); ?>
                            <?php echo $last_update ? date_i18n('d/m/Y H:i', strtotime($last_update)) : __('N/A', 'photo-renamer'); ?>
                        </span>
                    </div>
                    
                    <!-- Search -->
                    <div class="search-box">
                        <span class="dashicons dashicons-search"></span>
                        <input type="text" id="search-mappings" placeholder="<?php _e('Cerca codice...', 'photo-renamer'); ?>" />
                    </div>
                    
                    <!-- Table -->
                    <div class="mappings-table-container">
                        <?php if ($total_mappings > 0): ?>
                            <table class="mappings-table">
                                <thead>
                                    <tr>
                                        <th><?php _e('Codice (Nome File)', 'photo-renamer'); ?></th>
                                        <th><?php _e('Cod Prodotto (Nuovo Nome)', 'photo-renamer'); ?></th>
                                    </tr>
                                </thead>
                                <tbody id="mappings-tbody">
                                    <?php foreach ($mappings as $codice => $cod_prodotto): ?>
                                        <tr data-codice="<?php echo esc_attr(strtolower($codice)); ?>" data-prodotto="<?php echo esc_attr(strtolower($cod_prodotto)); ?>">
                                            <td><?php echo esc_html($codice); ?></td>
                                            <td class="cod-prodotto"><?php echo esc_html($cod_prodotto); ?></td>
                                        </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                        <?php else: ?>
                            <div class="no-mappings">
                                <span class="dashicons dashicons-warning"></span>
                                <p><?php _e('Nessuna mappatura disponibile', 'photo-renamer'); ?></p>
                                <p class="subtitle"><?php _e('Clicca "Controlla Aggiornamenti" per caricare il file Excel', 'photo-renamer'); ?></p>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
