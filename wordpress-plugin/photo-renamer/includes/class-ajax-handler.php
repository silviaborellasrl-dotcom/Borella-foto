<?php
/**
 * AJAX Handler Class
 */

if (!defined('ABSPATH')) {
    exit;
}

class Photo_Renamer_Ajax_Handler {
    
    private $excel_parser;
    
    public function __construct($excel_parser) {
        $this->excel_parser = $excel_parser;
    }
    
    public function init() {
        add_action('wp_ajax_photo_renamer_process', array($this, 'process_images'));
        add_action('wp_ajax_photo_renamer_check_update', array($this, 'check_excel_update'));
        add_action('wp_ajax_photo_renamer_get_mappings', array($this, 'get_mappings'));
        add_action('wp_ajax_photo_renamer_download_zip', array($this, 'download_zip'));
    }
    
    /**
     * Process uploaded images
     */
    public function process_images() {
        check_ajax_referer('photo_renamer_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => __('Permessi insufficienti', 'photo-renamer')));
        }
        
        if (empty($_FILES['images'])) {
            wp_send_json_error(array('message' => __('Nessun file caricato', 'photo-renamer')));
        }
        
        $mappings = $this->excel_parser->get_mappings();
        
        if (empty($mappings)) {
            wp_send_json_error(array('message' => __('Nessuna mappatura Excel disponibile', 'photo-renamer')));
        }
        
        $upload_dir = wp_upload_dir();
        $temp_dir = $upload_dir['basedir'] . '/photo-renamer/temp';
        $session_id = wp_generate_uuid4();
        $session_dir = $temp_dir . '/' . $session_id;
        
        wp_mkdir_p($session_dir);
        
        $results = array();
        $success_count = 0;
        $error_count = 0;
        
        $files = $_FILES['images'];
        $file_count = is_array($files['name']) ? count($files['name']) : 1;
        
        for ($i = 0; $i < $file_count; $i++) {
            $name = is_array($files['name']) ? $files['name'][$i] : $files['name'];
            $tmp_name = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
            $error = is_array($files['error']) ? $files['error'][$i] : $files['error'];
            
            if ($error !== UPLOAD_ERR_OK) {
                $results[] = array(
                    'original_name' => $name,
                    'new_name' => $name,
                    'status' => 'error',
                    'message' => __('Errore nel caricamento del file', 'photo-renamer')
                );
                $error_count++;
                continue;
            }
            
            // Get file info
            $path_info = pathinfo($name);
            $base_name = $path_info['filename'];
            $extension = isset($path_info['extension']) ? strtolower($path_info['extension']) : '';
            
            // Check if extension is allowed
            $allowed_extensions = array('jpg', 'jpeg', 'png', 'webp');
            if (!in_array($extension, $allowed_extensions)) {
                $results[] = array(
                    'original_name' => $name,
                    'new_name' => $name,
                    'status' => 'error',
                    'message' => __('Formato file non supportato', 'photo-renamer')
                );
                $error_count++;
                continue;
            }
            
            // Check if mapping exists
            if (isset($mappings[$base_name])) {
                $new_base_name = $mappings[$base_name];
                $new_name = $new_base_name . '.' . $extension;
                
                // Move file to session directory with new name
                $destination = $session_dir . '/' . $new_name;
                
                if (move_uploaded_file($tmp_name, $destination)) {
                    $results[] = array(
                        'original_name' => $name,
                        'new_name' => $new_name,
                        'status' => 'success',
                        'message' => __('Rinominato con successo', 'photo-renamer')
                    );
                    $success_count++;
                } else {
                    $results[] = array(
                        'original_name' => $name,
                        'new_name' => $name,
                        'status' => 'error',
                        'message' => __('Errore nel salvataggio del file', 'photo-renamer')
                    );
                    $error_count++;
                }
            } else {
                $results[] = array(
                    'original_name' => $name,
                    'new_name' => $name,
                    'status' => 'error',
                    'message' => sprintf(__('Codice "%s" non trovato nel file Excel', 'photo-renamer'), $base_name)
                );
                $error_count++;
            }
        }
        
        // Store session data
        set_transient('photo_renamer_session_' . $session_id, array(
            'dir' => $session_dir,
            'results' => $results
        ), HOUR_IN_SECONDS);
        
        wp_send_json_success(array(
            'results' => $results,
            'success_count' => $success_count,
            'error_count' => $error_count,
            'zip_ready' => $success_count > 0,
            'session_id' => $session_id
        ));
    }
    
    /**
     * Check for Excel updates
     */
    public function check_excel_update() {
        check_ajax_referer('photo_renamer_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => __('Permessi insufficienti', 'photo-renamer')));
        }
        
        $result = $this->excel_parser->check_and_update_excel();
        
        if (is_wp_error($result)) {
            wp_send_json_error(array('message' => $result->get_error_message()));
        }
        
        wp_send_json_success($result);
    }
    
    /**
     * Get current mappings
     */
    public function get_mappings() {
        check_ajax_referer('photo_renamer_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => __('Permessi insufficienti', 'photo-renamer')));
        }
        
        $mappings = $this->excel_parser->get_mappings();
        $last_update = get_option('photo_renamer_last_update', '');
        $hash = get_option('photo_renamer_excel_hash', '');
        
        $mapping_list = array();
        foreach ($mappings as $codice => $cod_prodotto) {
            $mapping_list[] = array(
                'codice' => $codice,
                'cod_prodotto' => $cod_prodotto
            );
        }
        
        wp_send_json_success(array(
            'mappings' => $mapping_list,
            'total' => count($mapping_list),
            'last_updated' => $last_update,
            'file_hash' => $hash
        ));
    }
    
    /**
     * Download ZIP file
     */
    public function download_zip() {
        check_ajax_referer('photo_renamer_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die(__('Permessi insufficienti', 'photo-renamer'));
        }
        
        $session_id = isset($_GET['session_id']) ? sanitize_text_field($_GET['session_id']) : '';
        
        if (empty($session_id)) {
            wp_die(__('Sessione non valida', 'photo-renamer'));
        }
        
        $session_data = get_transient('photo_renamer_session_' . $session_id);
        
        if (!$session_data) {
            wp_die(__('Sessione scaduta', 'photo-renamer'));
        }
        
        $session_dir = $session_data['dir'];
        
        if (!is_dir($session_dir)) {
            wp_die(__('Directory non trovata', 'photo-renamer'));
        }
        
        // Create ZIP file
        $zip_file = $session_dir . '/foto_rinominate.zip';
        $zip = new ZipArchive();
        
        if ($zip->open($zip_file, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            wp_die(__('Impossibile creare il file ZIP', 'photo-renamer'));
        }
        
        $files = glob($session_dir . '/*.{jpg,jpeg,png,webp}', GLOB_BRACE);
        
        foreach ($files as $file) {
            $zip->addFile($file, basename($file));
        }
        
        $zip->close();
        
        // Send ZIP file
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="foto_rinominate_' . substr($session_id, 0, 8) . '.zip"');
        header('Content-Length: ' . filesize($zip_file));
        header('Pragma: no-cache');
        header('Expires: 0');
        
        readfile($zip_file);
        
        // Cleanup
        $this->cleanup_session($session_dir);
        delete_transient('photo_renamer_session_' . $session_id);
        
        exit;
    }
    
    /**
     * Cleanup session directory
     */
    private function cleanup_session($dir) {
        if (!is_dir($dir)) {
            return;
        }
        
        $files = glob($dir . '/*');
        foreach ($files as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }
        
        rmdir($dir);
    }
}
