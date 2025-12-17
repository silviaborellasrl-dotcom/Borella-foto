<?php
/**
 * Plugin Name: Photo Renamer
 * Plugin URI: https://www.borellacasalinghi.it
 * Description: Rinomina automaticamente le foto prendendo i dati dal file Excel CODICI PRODOTTI.xlsx
 * Version: 1.0.0
 * Author: Borella Casalinghi
 * License: GPL v2 or later
 * Text Domain: photo-renamer
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('PHOTO_RENAMER_VERSION', '1.0.0');
define('PHOTO_RENAMER_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('PHOTO_RENAMER_PLUGIN_URL', plugin_dir_url(__FILE__));
define('PHOTO_RENAMER_EXCEL_URL', 'https://www.borellacasalinghi.it/foto-prodotti/cartella-immagini/CODICI%20PRODOTTI.xlsx');

// Include required files
require_once PHOTO_RENAMER_PLUGIN_DIR . 'includes/class-photo-renamer.php';
require_once PHOTO_RENAMER_PLUGIN_DIR . 'includes/class-excel-parser.php';
require_once PHOTO_RENAMER_PLUGIN_DIR . 'includes/class-ajax-handler.php';

// Initialize the plugin
function photo_renamer_init() {
    $plugin = new Photo_Renamer();
    $plugin->init();
}
add_action('plugins_loaded', 'photo_renamer_init');

// Activation hook
register_activation_hook(__FILE__, 'photo_renamer_activate');
function photo_renamer_activate() {
    // Create upload directory
    $upload_dir = wp_upload_dir();
    $photo_renamer_dir = $upload_dir['basedir'] . '/photo-renamer';
    
    if (!file_exists($photo_renamer_dir)) {
        wp_mkdir_p($photo_renamer_dir);
    }
    
    // Create temp directory
    $temp_dir = $photo_renamer_dir . '/temp';
    if (!file_exists($temp_dir)) {
        wp_mkdir_p($temp_dir);
    }
    
    // Schedule cron for Excel updates
    if (!wp_next_scheduled('photo_renamer_check_excel_update')) {
        wp_schedule_event(time(), 'hourly', 'photo_renamer_check_excel_update');
    }
    
    // Flush rewrite rules
    flush_rewrite_rules();
}

// Deactivation hook
register_deactivation_hook(__FILE__, 'photo_renamer_deactivate');
function photo_renamer_deactivate() {
    // Clear scheduled cron
    wp_clear_scheduled_hook('photo_renamer_check_excel_update');
}

// Uninstall hook
register_uninstall_hook(__FILE__, 'photo_renamer_uninstall');
function photo_renamer_uninstall() {
    // Clean up options
    delete_option('photo_renamer_excel_hash');
    delete_option('photo_renamer_excel_mappings');
    delete_option('photo_renamer_last_update');
    
    // Clean up upload directory
    $upload_dir = wp_upload_dir();
    $photo_renamer_dir = $upload_dir['basedir'] . '/photo-renamer';
    
    if (file_exists($photo_renamer_dir)) {
        photo_renamer_delete_directory($photo_renamer_dir);
    }
}

// Helper function to delete directory recursively
function photo_renamer_delete_directory($dir) {
    if (!file_exists($dir)) {
        return true;
    }
    
    if (!is_dir($dir)) {
        return unlink($dir);
    }
    
    foreach (scandir($dir) as $item) {
        if ($item == '.' || $item == '..') {
            continue;
        }
        
        if (!photo_renamer_delete_directory($dir . DIRECTORY_SEPARATOR . $item)) {
            return false;
        }
    }
    
    return rmdir($dir);
}
