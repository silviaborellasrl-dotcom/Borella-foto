import { useState, useEffect, useCallback } from "react";
import "@/App.css";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, 
  FileImage, 
  Download, 
  RefreshCw,
  CheckCircle2, 
  XCircle, 
  Loader2,
  Table2,
  Zap,
  Trash2,
  Search,
  AlertCircle,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [mappings, setMappings] = useState([]);
  const [loadingMappings, setLoadingMappings] = useState(true);
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [excelStatus, setExcelStatus] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // Fetch Excel mappings on load
  const fetchMappings = useCallback(async (refresh = false) => {
    setLoadingMappings(true);
    try {
      const response = await axios.get(`${API}/excel-mapping`, {
        params: { refresh, check_update: true }
      });
      setMappings(response.data.mappings);
      setExcelStatus({
        total: response.data.total,
        lastUpdated: response.data.last_updated,
        fileHash: response.data.file_hash
      });
      if (response.data.total > 0) {
        toast.success(`${response.data.total} mappature caricate`);
      }
    } catch (error) {
      console.error("Error fetching mappings:", error);
      toast.error("Errore nel caricamento delle mappature Excel");
    } finally {
      setLoadingMappings(false);
    }
  }, []);

  // Check for Excel updates
  const checkForUpdates = useCallback(async () => {
    setCheckingUpdate(true);
    try {
      const response = await axios.post(`${API}/check-excel-update`);
      
      if (response.data.updated) {
        toast.success(response.data.message);
        // Reload mappings
        await fetchMappings(false);
      } else if (response.data.error) {
        toast.error(response.data.message);
      } else {
        toast.info(response.data.message);
      }
    } catch (error) {
      console.error("Error checking updates:", error);
      toast.error("Errore nel controllo aggiornamenti");
    } finally {
      setCheckingUpdate(false);
    }
  }, [fetchMappings]);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  // Format date for display
  const formatDate = (isoString) => {
    if (!isoString) return "N/A";
    try {
      const date = new Date(isoString);
      return date.toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return "N/A";
    }
  };

  // Handle drag events
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/') || 
              ['jpg', 'jpeg', 'png', 'webp'].includes(file.name.split('.').pop().toLowerCase())
    );
    
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
      toast.success(`${droppedFiles.length} file aggiunti`);
    } else {
      toast.error("Nessun file immagine valido");
    }
  }, []);

  // Handle file input
  const handleFileInput = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
      toast.success(`${selectedFiles.length} file aggiunti`);
    }
    e.target.value = '';
  }, []);

  // Remove file
  const removeFile = useCallback((index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    setFiles([]);
    setResults(null);
    setSessionId(null);
  }, []);

  // Process images
  const processImages = async () => {
    if (files.length === 0) {
      toast.error("Nessun file selezionato");
      return;
    }

    if (mappings.length === 0) {
      toast.error("Nessuna mappatura Excel disponibile");
      return;
    }

    setProcessing(true);
    setUploadProgress(0);
    setResults(null);

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await axios.post(`${API}/process-images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      setResults(response.data);
      setSessionId(response.data.session_id);

      if (response.data.success_count > 0) {
        toast.success(`${response.data.success_count} foto rinominate con successo!`);
      }
      if (response.data.error_count > 0) {
        toast.warning(`${response.data.error_count} foto non trovate nel file Excel`);
      }
    } catch (error) {
      console.error("Error processing images:", error);
      toast.error(error.response?.data?.detail || "Errore nell'elaborazione delle immagini");
    } finally {
      setProcessing(false);
      setUploadProgress(0);
    }
  };

  // Download ZIP
  const downloadZip = async () => {
    if (!sessionId) return;

    try {
      const response = await axios.get(`${API}/download-zip/${sessionId}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `foto_rinominate.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Download completato!");
    } catch (error) {
      console.error("Error downloading ZIP:", error);
      toast.error("Errore nel download del file ZIP");
    }
  };

  // Filter mappings
  const filteredMappings = mappings.filter(m => 
    m.codice.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.cod_prodotto.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <Toaster 
        position="top-right" 
        theme="light"
        toastOptions={{
          style: {
            background: '#fff',
            border: '1px solid #e2e8f0',
            color: '#1e293b'
          }
        }}
      />

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-slate-800" data-testid="app-title">
                Photo Renamer
              </h1>
              <p className="text-xs text-slate-500">Rinomina automatica foto da Excel</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {mappings.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">{mappings.length} mappature</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={checkForUpdates}
              disabled={checkingUpdate || loadingMappings}
              className="border-slate-200 hover:bg-slate-50"
              data-testid="check-update-btn"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${checkingUpdate ? 'animate-spin' : ''}`} />
              Controlla Aggiornamenti
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel - Upload Zone */}
          <div className="lg:col-span-5 space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Upload Zone */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6">
                <h2 className="font-semibold text-lg text-slate-800 mb-4 flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <Upload className="w-4 h-4 text-blue-600" />
                  </div>
                  Carica Immagini
                </h2>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    relative border-2 border-dashed rounded-xl p-10
                    flex flex-col items-center justify-center cursor-pointer
                    transition-all duration-300 min-h-[220px]
                    ${isDragging 
                      ? 'dropzone-active border-blue-500 bg-blue-50' 
                      : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/50'
                    }
                  `}
                  data-testid="upload-dropzone"
                >
                  <input
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp,image/*"
                    onChange={handleFileInput}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    data-testid="file-input"
                  />
                  
                  <div className={`p-4 rounded-2xl mb-4 transition-all ${
                    isDragging ? 'bg-blue-100 scale-110' : 'bg-slate-100'
                  }`}>
                    <FileImage className={`w-10 h-10 ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
                  </div>
                  
                  <p className="text-center text-slate-600">
                    {isDragging 
                      ? <span className="text-blue-600 font-medium">Rilascia i file qui</span>
                      : <>
                          <span className="font-medium text-slate-700">Trascina le immagini qui</span>
                          <br/>
                          <span className="text-slate-500">oppure <span className="text-blue-600 font-medium">clicca per selezionare</span></span>
                        </>
                    }
                  </p>
                  <p className="text-xs text-slate-400 mt-3 font-medium">JPG, JPEG, PNG, WEBP</p>
                </div>

                {/* File List */}
                <AnimatePresence>
                  {files.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-5"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-600">
                          {files.length} file selezionati
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearFiles}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2"
                          data-testid="clear-files-btn"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Rimuovi tutti
                        </Button>
                      </div>
                      
                      <ScrollArea className="max-h-[180px]">
                        <div className="space-y-2">
                          {files.map((file, index) => (
                            <motion.div
                              key={`${file.name}-${index}`}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileImage className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <span className="text-sm text-slate-700 truncate max-w-[180px]">
                                  {file.name}
                                </span>
                              </div>
                              <button
                                onClick={() => removeFile(index)}
                                className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                data-testid={`remove-file-${index}`}
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      </ScrollArea>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Progress Bar */}
              {processing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white rounded-xl border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Elaborazione in corso...</span>
                    <span className="font-semibold text-blue-600">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={processImages}
                  disabled={files.length === 0 || processing || mappings.length === 0}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:shadow-none h-12"
                  data-testid="process-btn"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Elaborazione...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 mr-2" />
                      Rinomina Foto
                    </>
                  )}
                </Button>

                {results?.zip_ready && sessionId && (
                  <Button
                    onClick={downloadZip}
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium shadow-lg shadow-green-500/25 h-12 px-6"
                    data-testid="download-zip-btn"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Scarica ZIP
                  </Button>
                )}
              </div>

              {/* Results */}
              <AnimatePresence>
                {results && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6"
                    data-testid="results-section"
                  >
                    <h3 className="font-semibold text-lg text-slate-800 mb-4">Risultati</h3>
                    
                    <div className="flex gap-4 mb-5">
                      <div className="flex-1 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-green-600" data-testid="success-count">
                          {results.success_count}
                        </p>
                        <p className="text-sm text-green-600/80 font-medium">Successi</p>
                      </div>
                      <div className="flex-1 bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-red-500" data-testid="error-count">
                          {results.error_count}
                        </p>
                        <p className="text-sm text-red-500/80 font-medium">Errori</p>
                      </div>
                    </div>

                    <ScrollArea className="max-h-[220px]">
                      <div className="space-y-2">
                        {results.results.map((result, index) => (
                          <div
                            key={index}
                            className={`flex items-center gap-3 p-3 rounded-lg text-sm ${
                              result.status === 'success' 
                                ? 'bg-green-50 border border-green-100' 
                                : 'bg-red-50 border border-red-100'
                            }`}
                          >
                            {result.status === 'success' 
                              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                              : <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                            }
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">
                                <span className="text-slate-500">{result.original_name}</span>
                                {result.status === 'success' && (
                                  <>
                                    <span className="text-slate-400 mx-2">→</span>
                                    <span className="text-green-600 font-medium">{result.new_name}</span>
                                  </>
                                )}
                              </p>
                              {result.message && result.status === 'error' && (
                                <p className="text-xs text-red-500 mt-1">{result.message}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Right Panel - Mapping Table */}
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 h-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
                  <div className="p-1.5 bg-amber-100 rounded-lg">
                    <Table2 className="w-4 h-4 text-amber-600" />
                  </div>
                  Mappatura Excel
                  {mappings.length > 0 && (
                    <span className="ml-2 text-xs font-medium bg-slate-100 px-2.5 py-1 rounded-full text-slate-600">
                      {mappings.length} righe
                    </span>
                  )}
                </h2>
              </div>

              {/* Excel Status Info */}
              {excelStatus && (
                <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Clock className="w-4 h-4" />
                      <span>Ultimo aggiornamento: {formatDate(excelStatus.lastUpdated)}</span>
                    </div>
                  </div>
                  {excelStatus.fileHash && (
                    <div className="text-xs text-slate-400 font-mono">
                      Hash: {excelStatus.fileHash?.substring(0, 8)}...
                    </div>
                  )}
                </div>
              )}

              {/* Search */}
              <div className="mb-5 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cerca codice..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-slate-700 placeholder:text-slate-400 rounded-xl pl-10 pr-4 py-2.5 text-sm transition-all duration-200 outline-none"
                  data-testid="search-input"
                />
              </div>

              {/* Table */}
              {loadingMappings ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                  <p className="text-slate-500">Caricamento mappature...</p>
                </div>
              ) : mappings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="p-4 bg-amber-50 rounded-2xl mb-4">
                    <AlertCircle className="w-10 h-10 text-amber-500" />
                  </div>
                  <p className="text-slate-600 font-medium mb-2">Nessuna mappatura disponibile</p>
                  <p className="text-sm text-slate-400">Impossibile caricare il file Excel</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchMappings(true)}
                    className="mt-4"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Riprova
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[420px]" data-testid="mappings-table">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b-2 border-slate-100 pb-3 pl-3">
                          Codice (Nome File)
                        </th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b-2 border-slate-100 pb-3">
                          Cod Prodotto (Nuovo Nome)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMappings.map((mapping, index) => (
                        <tr 
                          key={index}
                          className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors"
                        >
                          <td className="py-3 text-sm text-slate-700 pl-3 font-medium">
                            {mapping.codice}
                          </td>
                          <td className="py-3 text-sm text-blue-600 font-medium">
                            {mapping.cod_prodotto}
                          </td>
                        </tr>
                      ))}
                      {filteredMappings.length === 0 && (
                        <tr>
                          <td colSpan={2} className="py-10 text-center text-slate-400">
                            {searchTerm ? 'Nessun risultato trovato' : 'Nessuna mappatura disponibile'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </motion.div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-500">
          Photo Renamer &middot; Rinomina automatica foto da Excel
        </div>
      </footer>
    </div>
  );
}

export default App;
