<?php
/**
 * SimpleXLSX - Lightweight Excel XLSX Parser
 * 
 * This is a simplified version for parsing Excel files.
 * For full functionality, consider using PhpSpreadsheet.
 * 
 * @link https://github.com/shuchkin/simplexlsx
 */

if (!defined('ABSPATH')) {
    exit;
}

class SimpleXLSX {
    
    private $sheets = array();
    private $sharedStrings = array();
    private $package = array();
    
    public static function parse($file) {
        $xlsx = new self();
        return $xlsx->_parse($file) ? $xlsx : false;
    }
    
    private function _parse($file) {
        $zip = new ZipArchive();
        
        if ($zip->open($file) !== true) {
            return false;
        }
        
        // Read shared strings
        $sharedStringsXml = $zip->getFromName('xl/sharedStrings.xml');
        if ($sharedStringsXml) {
            $this->parseSharedStrings($sharedStringsXml);
        }
        
        // Read worksheet
        $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
        if ($sheetXml) {
            $this->parseSheet($sheetXml);
        }
        
        $zip->close();
        
        return true;
    }
    
    private function parseSharedStrings($xml) {
        $doc = new DOMDocument();
        $doc->loadXML($xml);
        
        $elements = $doc->getElementsByTagName('t');
        
        foreach ($elements as $element) {
            $this->sharedStrings[] = $element->nodeValue;
        }
    }
    
    private function parseSheet($xml) {
        $doc = new DOMDocument();
        $doc->loadXML($xml);
        
        $rows = $doc->getElementsByTagName('row');
        
        foreach ($rows as $row) {
            $rowData = array();
            $cells = $row->getElementsByTagName('c');
            
            $maxCol = 0;
            foreach ($cells as $cell) {
                $ref = $cell->getAttribute('r');
                $col = $this->getColumnIndex($ref);
                $maxCol = max($maxCol, $col);
            }
            
            // Initialize row with empty values
            for ($i = 0; $i <= $maxCol; $i++) {
                $rowData[$i] = '';
            }
            
            foreach ($cells as $cell) {
                $ref = $cell->getAttribute('r');
                $col = $this->getColumnIndex($ref);
                $type = $cell->getAttribute('t');
                
                $valueElement = $cell->getElementsByTagName('v')->item(0);
                $value = $valueElement ? $valueElement->nodeValue : '';
                
                // Handle shared strings
                if ($type === 's' && isset($this->sharedStrings[(int)$value])) {
                    $value = $this->sharedStrings[(int)$value];
                }
                
                $rowData[$col] = $value;
            }
            
            $this->sheets[0][] = $rowData;
        }
    }
    
    private function getColumnIndex($ref) {
        preg_match('/^([A-Z]+)/', $ref, $matches);
        $col = $matches[1];
        
        $index = 0;
        $length = strlen($col);
        
        for ($i = 0; $i < $length; $i++) {
            $index = $index * 26 + (ord($col[$i]) - ord('A') + 1);
        }
        
        return $index - 1;
    }
    
    public function rows($sheetIndex = 0) {
        return isset($this->sheets[$sheetIndex]) ? $this->sheets[$sheetIndex] : array();
    }
}
