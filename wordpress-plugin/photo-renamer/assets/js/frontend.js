/**
 * Photo Renamer Frontend JavaScript
 */

(function($) {
    'use strict';
    
    // Variables
    var files = [];
    var sessionId = null;
    
    // DOM Elements
    var $container = $('#photo-renamer-app');
    var $dropzone = $('#pr-dropzone');
    var $fileInput = $('#pr-file-input');
    var $fileList = $('#pr-file-list');
    var $fileItems = $('#pr-file-items');
    var $fileCount = $('#pr-file-count');
    var $btnProcess = $('#pr-btn-process');
    var $btnDownload = $('#pr-btn-download');
    var $btnClear = $('#pr-btn-clear');
    var $progress = $('#pr-progress');
    var $progressFill = $('#pr-progress-fill');
    var $progressPercent = $('#pr-progress-percent');
    var $results = $('#pr-results');
    var $resultsList = $('#pr-results-list');
    var $successCount = $('#pr-success-count');
    var $errorCount = $('#pr-error-count');
    var $search = $('#pr-search');
    var $toast = $('#pr-toast');
    
    // Initialize
    function init() {
        if ($container.length === 0) return;
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
            handleFiles(e.originalEvent.dataTransfer.files);
        });
        
        // File input change
        $fileInput.on('change', function() {
            handleFiles(this.files);
            this.value = '';
        });
        
        // Clear files button
        $btnClear.on('click', function() {
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
        
        // Search mappings
        $search.on('input', function() {
            filterMappings($(this).val());
        });
    }
    
    // Handle files
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
            showToast('success', addedCount + ' ' + photoRenamerFrontend.strings.filesAdded);
            updateFileList();
        } else if (fileList.length > 0) {
            showToast('error', photoRenamerFrontend.strings.invalidFile);
        }
    }
    
    // Update file list
    function updateFileList() {
        if (files.length === 0) {
            $fileList.hide();
            $btnProcess.prop('disabled', true);
            return;
        }
        
        $fileList.show();
        $fileCount.text(files.length + ' ' + photoRenamerFrontend.strings.filesSelected);
        $fileItems.empty();
        
        files.forEach(function(file, index) {
            var $item = $('<div class="pr-file-item">' +
                '<div class="pr-file-item-name">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>' +
                    '<span>' + escapeHtml(file.name) + '</span>' +
                '</div>' +
                '<button type="button" class="pr-file-item-remove" data-index="' + index + '">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>' +
                '</button>' +
            '</div>');
            
            $item.find('.pr-file-item-remove').on('click', function() {
                removeFile($(this).data('index'));
            });
            
            $fileItems.append($item);
        });
        
        $btnProcess.prop('disabled', false);
    }
    
    // Remove file
    function removeFile(index) {
        files.splice(index, 1);
        updateFileList();
    }
    
    // Clear files
    function clearFiles() {
        files = [];
        sessionId = null;
        $btnDownload.hide();
        $results.hide();
        updateFileList();
    }
    
    // Process images
    function processImages() {
        if (files.length === 0) {
            showToast('error', photoRenamerFrontend.strings.noFiles);
            return;
        }
        
        var formData = new FormData();
        files.forEach(function(file) {
            formData.append('images[]', file);
        });
        formData.append('action', 'photo_renamer_frontend_process');
        formData.append('nonce', photoRenamerFrontend.nonce);
        
        // Show progress
        $progress.show();
        $progressFill.css('width', '0%');
        $progressPercent.text('0%');
        $btnProcess.prop('disabled', true);
        $results.hide();
        $btnDownload.hide();
        
        $.ajax({
            url: photoRenamerFrontend.ajaxUrl,
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
                $progress.hide();
                $btnProcess.prop('disabled', false);
                
                if (response.success) {
                    showResults(response.data);
                    
                    if (response.data.zip_ready) {
                        sessionId = response.data.session_id;
                        $btnDownload.show();
                    }
                } else {
                    showToast('error', response.data.message || photoRenamerFrontend.strings.error);
                }
            },
            error: function() {
                $progress.hide();
                $btnProcess.prop('disabled', false);
                showToast('error', photoRenamerFrontend.strings.error);
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
            var iconSvg = result.status === 'success' 
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
            
            var html = '<div class="pr-result-item ' + statusClass + '">' +
                iconSvg +
                '<div class="pr-result-item-content">' +
                    '<div class="pr-result-item-names">' +
                        '<span class="original">' + escapeHtml(result.original_name) + '</span>';
            
            if (result.status === 'success') {
                html += '<span class="arrow">→</span>' +
                        '<span class="new">' + escapeHtml(result.new_name) + '</span>';
            }
            
            html += '</div>';
            
            if (result.status === 'error' && result.message) {
                html += '<div class="pr-result-item-message">' + escapeHtml(result.message) + '</div>';
            }
            
            html += '</div></div>';
            
            $resultsList.append(html);
        });
        
        $results.show();
        
        if (data.success_count > 0) {
            showToast('success', data.success_count + ' ' + photoRenamerFrontend.strings.renamed);
        }
    }
    
    // Download ZIP
    function downloadZip() {
        if (!sessionId) return;
        
        var url = photoRenamerFrontend.ajaxUrl + 
            '?action=photo_renamer_frontend_download' +
            '&session_id=' + sessionId +
            '&nonce=' + photoRenamerFrontend.nonce;
        
        window.location.href = url;
    }
    
    // Filter mappings
    function filterMappings(term) {
        term = term.toLowerCase();
        
        $('#pr-mappings-tbody tr').each(function() {
            var $row = $(this);
            var codice = $row.data('codice') || '';
            var prodotto = $row.data('prodotto') || '';
            
            if (codice.toString().indexOf(term) !== -1 || prodotto.toString().indexOf(term) !== -1) {
                $row.removeClass('hidden');
            } else {
                $row.addClass('hidden');
            }
        });
    }
    
    // Show toast
    function showToast(type, message) {
        $toast.removeClass('success error info').addClass(type + ' show').text(message);
        
        setTimeout(function() {
            $toast.removeClass('show');
        }, 4000);
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
