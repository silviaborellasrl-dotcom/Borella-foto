<?php
/**
 * Main Photo Renamer Class
 */

if (!defined('ABSPATH')) {
    exit;
}

class Photo_Renamer {
    
    private $excel_parser;
    private $ajax_handler;
    
    public function __construct() {
        $this->excel_parser = new Photo_Renamer_Excel_Parser();
        $this->ajax_handler = new Photo_Renamer_Ajax_Handler($this->excel_parser);
    }
    
    public function init() {
        // Add admin menu
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Enqueue scripts and styles
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_assets'));
        
        // Initialize AJAX handler
        $this->ajax_handler->init();
        
        // Cron job for Excel updates
        add_action('photo_renamer_check_excel_update', array($this->excel_parser, 'check_and_update_excel'));
    }
    
    public function add_admin_menu() {
        add_menu_page(
            __('Photo Renamer', 'photo-renamer'),
            __('Photo Renamer', 'photo-renamer'),
            'manage_options',
            'photo-renamer',
            array($this, 'render_admin_page'),
            'dashicons-images-alt2',
            30
        );
    }
    
    public function enqueue_admin_assets($hook) {
        if ($hook !== 'toplevel_page_photo-renamer') {
            return;
        }
        
        // Enqueue styles
        wp_enqueue_style(
            'photo-renamer-admin',
            PHOTO_RENAMER_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            PHOTO_RENAMER_VERSION
        );
        
        // Enqueue scripts
        wp_enqueue_script(
            'photo-renamer-admin',
            PHOTO_RENAMER_PLUGIN_URL . 'assets/js/admin.js',
            array('jquery'),
            PHOTO_RENAMER_VERSION,
            true
        );
        
        // Localize script
        wp_localize_script('photo-renamer-admin', 'photoRenamerData', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('photo_renamer_nonce'),
            'strings' => array(
                'uploading' => __('Caricamento in corso...', 'photo-renamer'),
                'processing' => __('Elaborazione in corso...', 'photo-renamer'),
                'success' => __('Operazione completata!', 'photo-renamer'),
                'error' => __('Si è verificato un errore', 'photo-renamer'),
                'noFiles' => __('Nessun file selezionato', 'photo-renamer'),
                'invalidFile' => __('Formato file non valido', 'photo-renamer'),
            )
        ));
    }
    
    public function render_admin_page() {
        // Get current mappings
        $mappings = $this->excel_parser->get_mappings();
        $last_update = get_option('photo_renamer_last_update', '');
        $total_mappings = count($mappings);
        
        include PHOTO_RENAMER_PLUGIN_DIR . 'templates/admin-page.php';
    }
}
