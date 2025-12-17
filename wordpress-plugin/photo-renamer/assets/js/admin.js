/**
 * Photo Renamer Admin JavaScript
 */

(function($) {
    'use strict';
    
    // Variables
    var files = [];
    var sessionId = null;
    
    // DOM Elements
    var $dropzone = $('#dropzone');
    var $fileInput = $('#file-input');
    var $fileList = $('#file-list');
    var $fileItems = $('#file-items');
    var $fileCount = $('#file-count');
    var $btnProcess = $('#btn-process');
    var $btnDownload = $('#btn-download');
    var $btnClearFiles = $('#btn-clear-files');
    var $btnCheckUpdate = $('#btn-check-update');
    var $progressContainer = $('#progress-container');
    var $progressFill = $('#progress-fill');
    var $progressPercent = $('#progress-percent');
    var $resultsContainer = $('#results-container');
    var $resultsList = $('#results-list');
    var $successCount = $('#success-count');
    var $errorCount = $('#error-count');
    var $searchMappings = $('#search-mappings');
    
    // Initialize
    function init() {
        bindEvents();
    }
    
    // Bind Events
    function bindEvents() {
        // Dropzone events
        $dropzone.on('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).addClass('dragover');
        });
        
        $dropzone.on('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).removeClass('dragover');
        });
        
        $dropzone.on('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).removeClass('dragover');
            
            var droppedFiles = e.originalEvent.dataTransfer.files;
            handleFiles(droppedFiles);
        });
        
        // File input change
        $fileInput.on('change', function() {
            handleFiles(this.files);
            this.value = '';
        });
        
        // Clear files button
        $btnClearFiles.on('click', function() {
            clearFiles();
        });
        
        // Process button
        $btnProcess.on('click', function() {
            processImages();
        });
        
        // Download button
        $btnDownload.on('click', function() {
            downloadZip();
        });
        
        // Check update button
        $btnCheckUpdate.on('click', function() {
            checkExcelUpdate();
        });
        
        // Search mappings
        $searchMappings.on('input', function() {
            filterMappings($(this).val());
        });
    }
    
    // Handle dropped/selected files
    function handleFiles(fileList) {
        var allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
        var addedCount = 0;
        
        for (var i = 0; i < fileList.length; i++) {
            var file = fileList[i];
            var ext = file.name.split('.').pop().toLowerCase();
            
            if (allowedExtensions.indexOf(ext) !== -1) {
                files.push(file);
                addedCount++;
            }
        }
        
        if (addedCount > 0) {
            showNotification('success', addedCount + ' file aggiunti');
            updateFileList();
        } else if (fileList.length > 0) {
            showNotification('error', photoRenamerData.strings.invalidFile);
        }
    }
    
    // Update file list display
    function updateFileList() {
        if (files.length === 0) {
            $fileList.hide();
            $btnProcess.prop('disabled', true);
            return;
        }
        
        $fileList.show();
        $fileCount.text(files.length + ' file selezionati');
        $fileItems.empty();
        
        files.forEach(function(file, index) {
            var $item = $('<div class="file-item">' +
                '<div class="file-item-name">' +
                    '<span class="dashicons dashicons-format-image"></span>' +
                    '<span>' + escapeHtml(file.name) + '</span>' +
                '</div>' +
                '<button type="button" class="file-item-remove" data-index="' + index + '">' +
                    '<span class="dashicons dashicons-no-alt"></span>' +
                '</button>' +
            '</div>');
            
            $item.find('.file-item-remove').on('click', function() {
                removeFile($(this).data('index'));
            });
            
            $fileItems.append($item);
        });
        
        $btnProcess.prop('disabled', false);
    }
    
    // Remove single file
    function removeFile(index) {
        files.splice(index, 1);
        updateFileList();
    }
    
    // Clear all files
    function clearFiles() {
        files = [];
        sessionId = null;
        $btnDownload.hide();
        $resultsContainer.hide();
        updateFileList();
    }
    
    // Process images
    function processImages() {
        if (files.length === 0) {
            showNotification('error', photoRenamerData.strings.noFiles);
            return;
        }
        
        var formData = new FormData();
        files.forEach(function(file) {
            formData.append('images[]', file);
        });
        formData.append('action', 'photo_renamer_process');
        formData.append('nonce', photoRenamerData.nonce);
        
        // Show progress
        $progressContainer.show();
        $progressFill.css('width', '0%');
        $progressPercent.text('0%');
        $btnProcess.prop('disabled', true);
        $resultsContainer.hide();
        $btnDownload.hide();
        
        $.ajax({
            url: photoRenamerData.ajaxUrl,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            xhr: function() {
                var xhr = new window.XMLHttpRequest();
                xhr.upload.addEventListener('progress', function(e) {
                    if (e.lengthComputable) {
                        var percent = Math.round((e.loaded / e.total) * 100);
                        $progressFill.css('width', percent + '%');
                        $progressPercent.text(percent + '%');
                    }
                }, false);
                return xhr;
            },
            success: function(response) {
                $progressContainer.hide();
                $btnProcess.prop('disabled', false);
                
                if (response.success) {
                    showResults(response.data);
                    
                    if (response.data.zip_ready) {
                        sessionId = response.data.session_id;
                        $btnDownload.show();
                    }
                } else {
                    showNotification('error', response.data.message || photoRenamerData.strings.error);
                }
            },
            error: function() {
                $progressContainer.hide();
                $btnProcess.prop('disabled', false);
                showNotification('error', photoRenamerData.strings.error);
            }
        });
    }
    
    // Show results
    function showResults(data) {
        $successCount.text(data.success_count);
        $errorCount.text(data.error_count);
        
        $resultsList.empty();
        
        data.results.forEach(function(result) {
            var statusClass = result.status === 'success' ? 'success' : 'error';
            var iconClass = result.status === 'success' ? 'yes-alt' : 'no-alt';
            
            var html = '<div class="result-item ' + statusClass + '">' +
                '<span class="dashicons dashicons-' + iconClass + '"></span>' +
                '<div class="result-item-content">' +
                    '<div class="result-item-names">' +
                        '<span class="original">' + escapeHtml(result.original_name) + '</span>';
            
            if (result.status === 'success') {
                html += '<span class="arrow">→</span>' +
                        '<span class="new">' + escapeHtml(result.new_name) + '</span>';
            }
            
            html += '</div>';
            
            if (result.status === 'error' && result.message) {
                html += '<div class="result-item-message">' + escapeHtml(result.message) + '</div>';
            }
            
            html += '</div></div>';
            
            $resultsList.append(html);
        });
        
        $resultsContainer.show();
        
        if (data.success_count > 0) {
            showNotification('success', data.success_count + ' foto rinominate con successo!');
        }
    }
    
    // Download ZIP
    function downloadZip() {
        if (!sessionId) return;
        
        var url = photoRenamerData.ajaxUrl + 
            '?action=photo_renamer_download_zip' +
            '&session_id=' + sessionId +
            '&nonce=' + photoRenamerData.nonce;
        
        window.location.href = url;
    }
    
    // Check Excel update
    function checkExcelUpdate() {
        $btnCheckUpdate.addClass('loading').prop('disabled', true);
        
        $.ajax({
            url: photoRenamerData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'photo_renamer_check_update',
                nonce: photoRenamerData.nonce
            },
            success: function(response) {
                $btnCheckUpdate.removeClass('loading').prop('disabled', false);
                
                if (response.success) {
                    if (response.data.updated) {
                        showNotification('success', response.data.message);
                        // Reload page to show new mappings
                        setTimeout(function() {
                            location.reload();
                        }, 1500);
                    } else {
                        showNotification('info', response.data.message);
                    }
                } else {
                    showNotification('error', response.data.message || photoRenamerData.strings.error);
                }
            },
            error: function() {
                $btnCheckUpdate.removeClass('loading').prop('disabled', false);
                showNotification('error', photoRenamerData.strings.error);
            }
        });
    }
    
    // Filter mappings table
    function filterMappings(term) {
        term = term.toLowerCase();
        
        $('#mappings-tbody tr').each(function() {
            var $row = $(this);
            var codice = $row.data('codice') || '';
            var prodotto = $row.data('prodotto') || '';
            
            if (codice.indexOf(term) !== -1 || prodotto.indexOf(term) !== -1) {
                $row.removeClass('hidden');
            } else {
                $row.addClass('hidden');
            }
        });
    }
    
    // Show notification
    function showNotification(type, message) {
        // Remove existing notifications
        $('.photo-renamer-notice').remove();
        
        var $notice = $('<div class="photo-renamer-notice ' + type + '">' +
            '<span class="dashicons dashicons-' + (type === 'success' ? 'yes-alt' : (type === 'error' ? 'warning' : 'info')) + '"></span>' +
            '<span>' + escapeHtml(message) + '</span>' +
        '</div>');
        
        $('.photo-renamer-header').after($notice);
        
        setTimeout(function() {
            $notice.fadeOut(function() {
                $(this).remove();
            });
        }, 5000);
    }
    
    // Escape HTML
    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Initialize on document ready
    $(document).ready(init);
    
})(jQuery);
