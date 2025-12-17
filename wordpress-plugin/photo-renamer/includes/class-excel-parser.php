<?php
/**
 * Excel Parser Class
 */

if (!defined('ABSPATH')) {
    exit;
}

// Include PhpSpreadsheet autoloader if available
if (file_exists(PHOTO_RENAMER_PLUGIN_DIR . 'vendor/autoload.php')) {
    require_once PHOTO_RENAMER_PLUGIN_DIR . 'vendor/autoload.php';
}

class Photo_Renamer_Excel_Parser {
    
    private $excel_url;
    
    public function __construct() {
        $this->excel_url = PHOTO_RENAMER_EXCEL_URL;
    }
    
    /**
     * Get mappings from database or fetch from Excel
     */
    public function get_mappings() {
        $mappings = get_option('photo_renamer_excel_mappings', array());
        
        if (empty($mappings)) {
            $this->check_and_update_excel();
            $mappings = get_option('photo_renamer_excel_mappings', array());
        }
        
        return $mappings;
    }
    
    /**
     * Check if Excel file has been updated and refresh mappings
     */
    public function check_and_update_excel() {
        $result = $this->fetch_and_parse_excel();
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return array(
            'updated' => $result['updated'],
            'total' => count($result['mappings']),
            'message' => $result['message']
        );
    }
    
    /**
     * Fetch Excel file and parse mappings
     */
    private function fetch_and_parse_excel() {
        // Download Excel file
        $response = wp_remote_get($this->excel_url, array(
            'timeout' => 30,
            'headers' => array(
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
                'Referer' => 'https://www.borellacasalinghi.it/'
            )
        ));
        
        if (is_wp_error($response)) {
            return $response;
        }
        
        $body = wp_remote_retrieve_body($response);
        $status_code = wp_remote_retrieve_response_code($response);
        
        if ($status_code !== 200) {
            return new WP_Error('http_error', sprintf(__('Errore HTTP: %d', 'photo-renamer'), $status_code));
        }
        
        // Calculate hash
        $new_hash = md5($body);
        $old_hash = get_option('photo_renamer_excel_hash', '');
        
        // Check if file has changed
        if ($new_hash === $old_hash) {
            return array(
                'updated' => false,
                'mappings' => get_option('photo_renamer_excel_mappings', array()),
                'message' => __('File Excel non modificato', 'photo-renamer')
            );
        }
        
        // Parse Excel file
        $mappings = $this->parse_excel_content($body);
        
        if (is_wp_error($mappings)) {
            return $mappings;
        }
        
        // Save to database
        $old_count = count(get_option('photo_renamer_excel_mappings', array()));
        update_option('photo_renamer_excel_mappings', $mappings);
        update_option('photo_renamer_excel_hash', $new_hash);
        update_option('photo_renamer_last_update', current_time('mysql'));
        
        $diff = count($mappings) - $old_count;
        
        return array(
            'updated' => true,
            'mappings' => $mappings,
            'message' => sprintf(
                __('File Excel aggiornato! %d mappature (%+d rispetto a prima)', 'photo-renamer'),
                count($mappings),
                $diff
            )
        );
    }
    
    /**
     * Parse Excel content using SimpleXLSX or PhpSpreadsheet
     */
    private function parse_excel_content($content) {
        // Save to temp file
        $upload_dir = wp_upload_dir();
        $temp_file = $upload_dir['basedir'] . '/photo-renamer/temp/excel_' . time() . '.xlsx';
        
        file_put_contents($temp_file, $content);
        
        $mappings = array();
        
        // Try PhpSpreadsheet first
        if (class_exists('PhpOffice\PhpSpreadsheet\IOFactory')) {
            try {
                $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($temp_file);
                $worksheet = $spreadsheet->getActiveSheet();
                
                foreach ($worksheet->getRowIterator(2) as $row) {
                    $cellIterator = $row->getCellIterator();
                    $cellIterator->setIterateOnlyExistingCells(false);
                    
                    $cells = array();
                    foreach ($cellIterator as $cell) {
                        $cells[] = $cell->getValue();
                    }
                    
                    if (!empty($cells[0]) && !empty($cells[1])) {
                        $codice = trim((string)$cells[0]);
                        $cod_prodotto = trim((string)$cells[1]);
                        $mappings[$codice] = $cod_prodotto;
                    }
                }
                
                unlink($temp_file);
                return $mappings;
                
            } catch (Exception $e) {
                // Fall through to SimpleXLSX
            }
        }
        
        // Try SimpleXLSX
        if (file_exists(PHOTO_RENAMER_PLUGIN_DIR . 'includes/SimpleXLSX.php')) {
            require_once PHOTO_RENAMER_PLUGIN_DIR . 'includes/SimpleXLSX.php';
            
            if ($xlsx = SimpleXLSX::parse($temp_file)) {
                $rows = $xlsx->rows();
                
                // Skip header row
                for ($i = 1; $i < count($rows); $i++) {
                    $row = $rows[$i];
                    if (!empty($row[0]) && !empty($row[1])) {
                        $codice = trim((string)$row[0]);
                        $cod_prodotto = trim((string)$row[1]);
                        $mappings[$codice] = $cod_prodotto;
                    }
                }
                
                unlink($temp_file);
                return $mappings;
            }
        }
        
        unlink($temp_file);
        
        return new WP_Error('parse_error', __('Impossibile parsare il file Excel. Installa PhpSpreadsheet.', 'photo-renamer'));
    }
    
    /**
     * Force refresh mappings
     */
    public function force_refresh() {
        delete_option('photo_renamer_excel_hash');
        return $this->check_and_update_excel();
    }
}
