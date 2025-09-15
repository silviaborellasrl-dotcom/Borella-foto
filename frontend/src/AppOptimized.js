import React, { useState, useEffect } from "react";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://productfinder-3.preview.emergentagent.com";
const API = `${BACKEND_URL}/api`;

// Componenti semplificati per caricamento veloce
const SimpleButton = ({ onClick, disabled, className, children }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`px-4 py-2 rounded-lg font-medium transition-all ${className} ${
      disabled 
        ? 'bg-gray-300 cursor-not-allowed' 
        : 'bg-blue-600 hover:bg-blue-700 text-white active:transform active:scale-95'
    }`}
  >
    {children}
  </button>
);

const SimpleInput = ({ type = "text", placeholder, value, onChange, onKeyPress, className, accept, files }) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    onKeyPress={onKeyPress}
    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
    accept={accept}
    multiple={files}
  />
);

const SimpleCard = ({ title, children, className }) => (
  <div className={`bg-white rounded-lg shadow-lg border-0 backdrop-blur-sm ${className}`}>
    {title && (
      <div className="p-6 pb-0">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          {title}
        </h3>
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const ProgressBar = ({ percentage, found, notFound }) => (
  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-6">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-5 h-5 bg-blue-600 rounded animate-pulse"></div>
      <span className="text-blue-800 font-medium">Elaborazione in corso...</span>
    </div>
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span className="text-blue-700">Progresso: {percentage}%</span>
        <div className="flex gap-4">
          <span className="text-green-600">✅ Trovati: {found}</span>
          <span className="text-orange-600">❌ Non trovati: {notFound}</span>
        </div>
      </div>
      <div className="w-full bg-blue-100 rounded-full h-3">
        <div 
          className="bg-blue-600 h-3 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  </div>
);

function AppOptimized() {
  // Stati
  const [singleCode, setSingleCode] = useState("");
  const [singleResult, setSingleResult] = useState(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [showProgress, setShowProgress] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState("");
  const [modalImageCode, setModalImageCode] = useState("");
  const [activeTab, setActiveTab] = useState("single");

  // Funzione per aprire il modal zoom
  const openImageModal = (imageUrl, code) => {
    setModalImageUrl(imageUrl);
    setModalImageCode(code);
    setShowImageModal(true);
  };

  // Funzione per chiudere il modal
  const closeImageModal = () => {
    setShowImageModal(false);
    setModalImageUrl("");
    setModalImageCode("");
  };

  // Ricerca singola
  const handleSingleSearch = async () => {
    if (!singleCode.trim()) return;
    setSingleLoading(true);
    try {
      const response = await fetch(`${API}/search-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: singleCode.trim() })
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      setSingleResult(data);
    } catch (error) {
      setSingleResult({
        code: singleCode,
        found: false,
        error: "Errore nella ricerca"
      });
    } finally {
      setSingleLoading(false);
    }
  };

  // Download singolo
  const handleSingleDownload = async () => {
    if (!singleResult?.image_url) return;
    try {
      const filename = `${singleResult.code}${singleResult.format}`;
      const response = await fetch(
        `${API}/download-image?url=${encodeURIComponent(singleResult.image_url)}&filename=${encodeURIComponent(filename)}`
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Errore nel download:", error);
    }
  };

  // Gestione file
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.name.endsWith('.xlsx')) {
      setSelectedFile(file);
      setBatchResult(null);
    } else {
      alert('Seleziona un file Excel (.xlsx)');
      event.target.value = '';
    }
  };

  // Polling progresso
  const pollProgress = async (taskId) => {
    try {
      const response = await fetch(`${API}/progress/${taskId}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const progress = await response.json();
      setProgressData(progress);
      
      if (progress.status === "completed") {
        setShowProgress(false);
        setBatchLoading(false);
        setBatchResult({
          total_codes: progress.total_items,
          found_codes: progress.found_items || [],
          not_found_codes: progress.not_found_items || [],
          results: []
        });
        setCurrentTaskId(null);
        setTimeout(() => {
          setProgressData(prev => ({...prev, status: "completed"}));
        }, 100);
      } else if (progress.status === "error") {
        setShowProgress(false);
        setBatchLoading(false);
        setBatchResult({
          total_codes: progress.total_items,
          found_codes: [],
          not_found_codes: [],
          error: progress.current_item
        });
        setCurrentTaskId(null);
      } else {
        setTimeout(() => pollProgress(taskId), 1000);
      }
    } catch (error) {
      setShowProgress(false);
      setBatchLoading(false);
      setCurrentTaskId(null);
    }
  };

  // Ricerca batch
  const handleBatchSearch = async () => {
    if (!selectedFile) return;
    setBatchLoading(true);
    setShowProgress(true);
    setBatchResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await fetch(`${API}/search-batch-async`, {
        method: 'POST',
        body: formData
      });
      
      // Gestione errori migliorata
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `Errore HTTP ${response.status}`;
        
        // Mostra errore specifico all'utente
        setBatchResult({
          total_codes: 0,
          found_codes: [],
          not_found_codes: [],
          error: errorMessage
        });
        setBatchLoading(false);
        setShowProgress(false);
        return;
      }
      
      const data = await response.json();
      if (data.task_id) {
        setCurrentTaskId(data.task_id);
        pollProgress(data.task_id);
      } else {
        throw new Error("Task ID non ricevuto dal server");
      }
    } catch (error) {
      console.error("Errore nella ricerca batch:", error);
      setBatchResult({
        total_codes: 0,
        found_codes: [],
        not_found_codes: [],
        error: error.message || "Errore di connessione al server"
      });
      setBatchLoading(false);
      setShowProgress(false);
    }
  };

  // Download ZIP
  const handleBatchDownload = async () => {
    if (!selectedFile) return;
    setDownloadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await fetch(`${API}/download-batch-zip`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'immagini_prodotti.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert("Errore nel download del file ZIP");
    } finally {
      setDownloadLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header veloce */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <div className="w-6 h-6 bg-white rounded" style={{clipPath: 'polygon(0% 0%, 100% 50%, 0% 100%)'}}></div>
            </div>
            <h1 className="text-3xl font-bold text-slate-800">Sistema Ricerca Immagini</h1>
          </div>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            Cerca e scarica immagini prodotti utilizzando codici singoli o caricando file Excel
          </p>
        </div>

        {/* Tab navigation semplificata */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-lg">
            <button
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === "single" 
                  ? "bg-blue-600 text-white shadow-md" 
                  : "text-gray-600 hover:text-blue-600"
              }`}
              onClick={() => setActiveTab("single")}
            >
              🔍 Ricerca Singola
            </button>
            <button
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === "batch" 
                  ? "bg-blue-600 text-white shadow-md" 
                  : "text-gray-600 hover:text-blue-600"
              }`}
              onClick={() => setActiveTab("batch")}
            >
              📁 Ricerca Multipla
            </button>
          </div>
        </div>

        {/* Contenuto Tab Singola */}
        {activeTab === "single" && (
          <SimpleCard 
            title="🔍 Ricerca Immagine Singola"
            className="mb-6"
          >
            <p className="text-gray-600 mb-4">Inserisci un codice prodotto per cercare l'immagine corrispondente</p>
            
            <div className="flex gap-3 mb-4">
              <SimpleInput
                placeholder="Inserisci codice prodotto..."
                value={singleCode}
                onChange={(e) => setSingleCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSingleSearch()}
                className="flex-1"
              />
              <SimpleButton 
                onClick={handleSingleSearch}
                disabled={!singleCode.trim() || singleLoading}
                className="px-6"
              >
                {singleLoading ? "⏳ Cerca..." : "🔍 Cerca"}
              </SimpleButton>
            </div>

            {singleResult && (
              <div className="mt-4">
                {singleResult.found ? (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-green-800 font-medium">✅ Immagine trovata!</span>
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                        {singleResult.format}
                      </span>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Codice:</p>
                        <p className="font-mono font-semibold text-gray-800 mb-3">{singleResult.code}</p>
                        <SimpleButton 
                          onClick={handleSingleDownload}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          💾 Scarica Immagine
                        </SimpleButton>
                      </div>
                      
                      <div className="flex items-center justify-center">
                        <div className="w-full max-w-sm bg-white rounded-lg shadow-md overflow-hidden">
                          <div className="relative group">
                            <img
                              src={singleResult.image_url}
                              alt={`Prodotto ${singleResult.code}`}
                              className="w-full h-64 object-contain bg-gray-50 cursor-pointer transition-transform duration-200 group-hover:scale-105"
                              loading="lazy"
                              onClick={() => openImageModal(singleResult.image_url, singleResult.code)}
                              onError={(e) => {
                                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik02MCA2MEgxNDBWMTQwSDYwVjYwWiIgZmlsbD0iI0Q1RDdEQSIvPgo8L3N2Zz4K';
                              }}
                            />
                            {/* Overlay per indicare che è cliccabile */}
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <div className="bg-white bg-opacity-90 rounded-full p-3 shadow-lg">
                                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                          <div className="p-4">
                            <p className="text-sm text-gray-600 text-center mb-2">Anteprima immagine • Clicca per ingrandire</p>
                            <div className="text-xs text-gray-500 text-center">
                              Formato: {singleResult.format}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <p className="text-red-800">
                      <strong>❌ Codice: {singleResult.code}</strong><br />
                      {singleResult.error || 'Immagine non trovata'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </SimpleCard>
        )}

        {/* Contenuto Tab Batch */}
        {activeTab === "batch" && (
          <SimpleCard 
            title="📁 Ricerca Multipla da Excel"
            className="mb-6"
          >
            <p className="text-gray-600 mb-4">
              Carica un file Excel con la colonna "CODICE", "COD.PR" o "C.ART" per cercare più immagini contemporaneamente
            </p>
            
            <div className="space-y-4">
              <div>
                <SimpleInput
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileSelect}
                />
                <p className="text-sm text-gray-500 mt-2">
                  Formato supportato: .xlsx con colonna "CODICE", "COD.PR" o "C.ART"
                </p>
              </div>

              {selectedFile && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-blue-800 font-medium">📄 File selezionato:</p>
                  <p className="text-blue-700">{selectedFile.name}</p>
                </div>
              )}

              {/* Progress Bar */}
              {showProgress && progressData && (
                <ProgressBar 
                  percentage={progressData.progress_percentage || 0}
                  found={progressData.found_count || 0}
                  notFound={progressData.not_found_count || 0}
                />
              )}

              <div className="flex gap-3">
                <SimpleButton 
                  onClick={handleBatchSearch}
                  disabled={!selectedFile || batchLoading}
                >
                  {batchLoading ? "⏳ Analizza..." : "🔍 Analizza File"}
                </SimpleButton>

                {((batchResult && batchResult.found_codes?.length > 0) || 
                  (!batchResult && progressData && progressData.status === "completed" && progressData.found_count > 0)) && (
                  <SimpleButton 
                    onClick={handleBatchDownload}
                    disabled={downloadLoading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {downloadLoading ? "⏳ Download..." : `💾 Scarica ZIP ${
                      batchResult ? `(${batchResult.found_codes.length})` : 
                      progressData ? `(${progressData.found_count})` : ''
                    }`}
                  </SimpleButton>
                )}
              </div>
            </div>

            {batchResult && (
              <div className="space-y-4 mt-6">
                <hr className="border-gray-200" />
                
                {/* Gestione errori migliorata */}
                {batchResult.error && (
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-red-800 font-semibold mb-2">⚠️ Errore nell'elaborazione del file</h3>
                        <p className="text-red-700 text-sm leading-relaxed">{batchResult.error}</p>
                        
                        {/* Suggerimenti per risolvere errori comuni */}
                        <div className="mt-3 p-3 bg-red-100 rounded border border-red-200">
                          <p className="text-red-800 font-medium text-sm mb-2">💡 Suggerimenti:</p>
                          <ul className="text-red-700 text-sm space-y-1 list-disc list-inside">
                            <li>Verifica che il file sia in formato Excel (.xlsx)</li>
                            <li>Assicurati che la prima riga contenga una colonna chiamata "CODICE", "COD.PR" o "C.ART"</li>
                            <li>Controlla che ci siano dati nelle righe sotto l'intestazione</li>
                            <li>Il file non deve essere più grande di 10MB</li>
                          </ul>
                        </div>
                        
                        <button 
                          onClick={() => setBatchResult(null)}
                          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                        >
                          Chiudi e riprova
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Risultati normali (solo se non c'è errore) */}
                {!batchResult.error && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-gray-800">{batchResult.total_codes}</p>
                        <p className="text-sm text-gray-600">Codici totali</p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-green-700">{batchResult.found_codes?.length || 0}</p>
                        <p className="text-sm text-green-600">Immagini trovate</p>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-red-700">{batchResult.not_found_codes?.length || 0}</p>
                        <p className="text-sm text-red-600">Non trovate</p>
                      </div>
                    </div>

                    {batchResult.not_found_codes?.length > 0 && (
                      <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                        <p className="text-amber-800 font-medium mb-2">⚠️ Codici non trovati:</p>
                        <div className="flex flex-wrap gap-1">
                          {batchResult.not_found_codes.map((code, index) => (
                            <span key={index} className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-sm">
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {batchResult.found_codes?.length > 0 && (
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <p className="text-green-800 font-medium mb-2">✅ Immagini disponibili per il download:</p>
                        <div className="flex flex-wrap gap-1">
                          {batchResult.found_codes.map((code, index) => (
                            <span key={index} className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </SimpleCard>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600">
          <p className="text-sm">
            Sistema per la ricerca e download immagini prodotti • Borella Casalinghi
          </p>
        </div>
      </div>

      {/* Modal Zoom Immagine */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={closeImageModal}>
          <div className="relative bg-white rounded-lg shadow-2xl max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header del modal */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">
                Immagine Prodotto: {modalImageCode}
              </h3>
              <button
                onClick={closeImageModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Contenuto del modal */}
            <div className="p-4">
              <div className="flex justify-center">
                <img
                  src={modalImageUrl}
                  alt={`Prodotto ${modalImageCode}`}
                  className="max-w-full max-h-[70vh] object-contain bg-gray-50 rounded-lg"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMjAgMTIwSDI4MFYyODBIMTIwVjEyMFoiIGZpbGw9IiNENUQ3REEiLz4KPHRLEHU+PC90ZXh0PgoKPC9zdmc+';
                  }}
                />
              </div>
              
              {/* Azioni del modal */}
              <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-gray-200">
                <a
                  href={modalImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Apri in nuova scheda
                </a>
                <button
                  onClick={closeImageModal}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppOptimized;