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
  Trash2
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

  // Fetch Excel mappings
  const fetchMappings = useCallback(async (refresh = false) => {
    setLoadingMappings(true);
    try {
      const response = await axios.get(`${API}/excel-mapping`, {
        params: { refresh }
      });
      setMappings(response.data.mappings);
      toast.success(`${response.data.total} mappature caricate`);
    } catch (error) {
      console.error("Error fetching mappings:", error);
      toast.error("Errore nel caricamento delle mappature");
    } finally {
      setLoadingMappings(false);
    }
  }, []);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

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
      toast.error("Errore nell'elaborazione delle immagini");
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
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Noise overlay */}
      <div className="noise-overlay" />
      
      <Toaster 
        position="top-right" 
        theme="dark"
        toastOptions={{
          style: {
            background: '#18181b',
            border: '1px solid #27272a',
            color: '#fff'
          }
        }}
      />

      {/* Header */}
      <header className="border-b border-zinc-800 bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Zap className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="font-heading font-black text-xl tracking-tight" data-testid="app-title">
                Photo Renamer
              </h1>
              <p className="text-xs text-zinc-500 font-mono">EXCEL → IMAGE MAPPER</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchMappings(true)}
            disabled={loadingMappings}
            className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700"
            data-testid="refresh-mappings-btn"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loadingMappings ? 'animate-spin' : ''}`} />
            Aggiorna Excel
          </Button>
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
              <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-transparent" />
                
                <h2 className="font-heading font-bold text-lg mb-4 flex items-center gap-2 relative">
                  <Upload className="w-5 h-5 text-blue-500" />
                  Carica Immagini
                </h2>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    relative border-2 border-dashed rounded-xl p-8
                    flex flex-col items-center justify-center cursor-pointer
                    transition-all duration-300 min-h-[200px]
                    ${isDragging 
                      ? 'dropzone-active border-blue-500 bg-blue-500/10' 
                      : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/30 hover:bg-zinc-900/50'
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
                  
                  <div className={`p-4 rounded-full mb-4 transition-colors ${isDragging ? 'bg-blue-500/20' : 'bg-zinc-800'}`}>
                    <FileImage className={`w-8 h-8 ${isDragging ? 'text-blue-500' : 'text-zinc-500'}`} />
                  </div>
                  
                  <p className="text-center text-zinc-400 text-sm">
                    {isDragging 
                      ? <span className="text-blue-400 font-medium">Rilascia i file qui</span>
                      : <>Trascina le immagini qui<br/>oppure <span className="text-blue-400">clicca per selezionare</span></>
                    }
                  </p>
                  <p className="text-xs text-zinc-600 mt-2 font-mono">JPG, JPEG, PNG, WEBP</p>
                </div>

                {/* File List */}
                <AnimatePresence>
                  {files.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-zinc-400 font-mono">
                          {files.length} file selezionati
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearFiles}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2"
                          data-testid="clear-files-btn"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Rimuovi tutti
                        </Button>
                      </div>
                      
                      <ScrollArea className="max-h-[200px]">
                        <div className="space-y-2">
                          {files.map((file, index) => (
                            <motion.div
                              key={`${file.name}-${index}`}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2"
                            >
                              <span className="text-sm font-mono text-zinc-300 truncate max-w-[200px]">
                                {file.name}
                              </span>
                              <button
                                onClick={() => removeFile(index)}
                                className="text-zinc-500 hover:text-red-400 transition-colors p-1"
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
                  className="space-y-2"
                >
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Elaborazione in corso...</span>
                    <span className="font-mono text-blue-400">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={processImages}
                  disabled={files.length === 0 || processing}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium neon-glow"
                  data-testid="process-btn"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Elaborazione...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Rinomina Foto
                    </>
                  )}
                </Button>

                {results?.zip_ready && sessionId && (
                  <Button
                    onClick={downloadZip}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium"
                    data-testid="download-zip-btn"
                  >
                    <Download className="w-4 h-4 mr-2" />
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
                    className="bg-[#18181b] border border-zinc-800 rounded-xl p-6"
                    data-testid="results-section"
                  >
                    <h3 className="font-heading font-bold text-lg mb-4">Risultati</h3>
                    
                    <div className="flex gap-4 mb-4">
                      <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-green-400" data-testid="success-count">
                          {results.success_count}
                        </p>
                        <p className="text-xs text-zinc-500">Successi</p>
                      </div>
                      <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-red-400" data-testid="error-count">
                          {results.error_count}
                        </p>
                        <p className="text-xs text-zinc-500">Errori</p>
                      </div>
                    </div>

                    <ScrollArea className="max-h-[200px]">
                      <div className="space-y-2">
                        {results.results.map((result, index) => (
                          <div
                            key={index}
                            className={`flex items-center gap-3 p-2 rounded-lg text-sm ${
                              result.status === 'success' 
                                ? 'bg-green-500/5 border border-green-500/10' 
                                : 'bg-red-500/5 border border-red-500/10'
                            }`}
                          >
                            {result.status === 'success' 
                              ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                              : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            }
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-xs truncate">
                                <span className="text-zinc-500">{result.original_name}</span>
                                {result.status === 'success' && (
                                  <>
                                    <span className="text-zinc-600 mx-2">→</span>
                                    <span className="text-green-400">{result.new_name}</span>
                                  </>
                                )}
                              </p>
                              {result.message && result.status === 'error' && (
                                <p className="text-xs text-red-400/70 mt-1">{result.message}</p>
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
              className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 h-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-bold text-lg flex items-center gap-2">
                  <Table2 className="w-5 h-5 text-amber-500" />
                  Mappatura Excel
                  <span className="ml-2 text-xs font-mono bg-zinc-800 px-2 py-1 rounded text-zinc-400">
                    {mappings.length} righe
                  </span>
                </h2>
              </div>

              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Cerca codice..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder:text-zinc-600 rounded-lg px-4 py-2 font-mono text-sm transition-all duration-200 outline-none"
                  data-testid="search-input"
                />
              </div>

              {/* Table */}
              {loadingMappings ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="h-[500px]" data-testid="mappings-table">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-[#18181b] z-10">
                      <tr>
                        <th className="text-left text-xs font-mono text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-3 pl-3">
                          Codice (Nome File)
                        </th>
                        <th className="text-left text-xs font-mono text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-3">
                          Cod Prodotto (Nuovo Nome)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMappings.map((mapping, index) => (
                        <tr 
                          key={index}
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="py-3 text-sm font-mono text-zinc-300 pl-3">
                            {mapping.codice}
                          </td>
                          <td className="py-3 text-sm font-mono text-blue-400">
                            {mapping.cod_prodotto}
                          </td>
                        </tr>
                      ))}
                      {filteredMappings.length === 0 && (
                        <tr>
                          <td colSpan={2} className="py-8 text-center text-zinc-500">
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
      <footer className="border-t border-zinc-800 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-zinc-600 font-mono">
          Photo Renamer &middot; Rinomina automatica foto da Excel
        </div>
      </footer>
    </div>
  );
}

export default App;
