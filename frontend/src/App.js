import { useState, useEffect, useCallback } from "react";
import "@/App.css";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, 
  FileImage, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Table2,
  Zap,
  Trash2,
  FileSpreadsheet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [mappings, setMappings] = useState([]);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingExcel, setIsDraggingExcel] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [excelLoaded, setExcelLoaded] = useState(false);

  // Fetch existing mappings on load
  const fetchMappings = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/excel-mapping`);
      if (response.data.total > 0) {
        setMappings(response.data.mappings);
        setExcelLoaded(true);
      }
    } catch (error) {
      console.error("Error fetching mappings:", error);
    }
  }, []);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  // Handle Excel upload
  const handleExcelUpload = async (file) => {
    if (!file) return;
    
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error("Seleziona un file Excel (.xlsx o .xls)");
      return;
    }

    setLoadingMappings(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/upload-excel`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMappings(response.data.mappings);
      setExcelLoaded(true);
      toast.success(`${response.data.total} mappature caricate con successo!`);
    } catch (error) {
      console.error("Error uploading Excel:", error);
      toast.error(error.response?.data?.detail || "Errore nel caricamento del file Excel");
    } finally {
      setLoadingMappings(false);
    }
  };

  // Handle Excel drag events
  const handleExcelDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingExcel(true);
  }, []);

  const handleExcelDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingExcel(false);
  }, []);

  const handleExcelDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingExcel(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    const excelFile = droppedFiles.find(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
    
    if (excelFile) {
      handleExcelUpload(excelFile);
    } else {
      toast.error("Seleziona un file Excel (.xlsx o .xls)");
    }
  }, []);

  const handleExcelInput = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      handleExcelUpload(file);
    }
    e.target.value = '';
  }, []);

  // Handle image drag events
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

    if (!excelLoaded) {
      toast.error("Carica prima il file Excel con le mappature");
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
          {excelLoaded && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-zinc-400 font-mono">{mappings.length} mappature</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel - Upload Zones */}
          <div className="lg:col-span-5 space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Excel Upload Zone */}
              <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 via-transparent to-transparent" />
                
                <h2 className="font-heading font-bold text-lg mb-4 flex items-center gap-2 relative">
                  <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                  1. Carica File Excel
                  {excelLoaded && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
                </h2>

                <div
                  onDragOver={handleExcelDragOver}
                  onDragLeave={handleExcelDragLeave}
                  onDrop={handleExcelDrop}
                  className={`
                    relative border-2 border-dashed rounded-xl p-6
                    flex flex-col items-center justify-center cursor-pointer
                    transition-all duration-300
                    ${isDraggingExcel 
                      ? 'border-amber-500 bg-amber-500/10' 
                      : excelLoaded 
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/30 hover:bg-zinc-900/50'
                    }
                  `}
                  data-testid="excel-dropzone"
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelInput}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    data-testid="excel-input"
                  />
                  
                  {loadingMappings ? (
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                  ) : (
                    <>
                      <div className={`p-3 rounded-full mb-3 transition-colors ${
                        isDraggingExcel ? 'bg-amber-500/20' : excelLoaded ? 'bg-green-500/20' : 'bg-zinc-800'
                      }`}>
                        <FileSpreadsheet className={`w-6 h-6 ${
                          isDraggingExcel ? 'text-amber-500' : excelLoaded ? 'text-green-500' : 'text-zinc-500'
                        }`} />
                      </div>
                      
                      <p className="text-center text-zinc-400 text-sm">
                        {excelLoaded 
                          ? <span className="text-green-400">File Excel caricato</span>
                          : isDraggingExcel 
                            ? <span className="text-amber-400">Rilascia il file Excel</span>
                            : <>Trascina il file Excel qui<br/>oppure <span className="text-amber-400">clicca per selezionare</span></>
                        }
                      </p>
                      <p className="text-xs text-zinc-600 mt-2 font-mono">CODICI PRODOTTI.xlsx</p>
                    </>
                  )}
                </div>
              </div>

              {/* Image Upload Zone */}
              <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-transparent" />
                
                <h2 className="font-heading font-bold text-lg mb-4 flex items-center gap-2 relative">
                  <Upload className="w-5 h-5 text-blue-500" />
                  2. Carica Immagini
                </h2>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    relative border-2 border-dashed rounded-xl p-8
                    flex flex-col items-center justify-center cursor-pointer
                    transition-all duration-300 min-h-[180px]
                    ${!excelLoaded ? 'opacity-50 cursor-not-allowed' : ''}
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
                    disabled={!excelLoaded}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    data-testid="file-input"
                  />
                  
                  <div className={`p-4 rounded-full mb-4 transition-colors ${isDragging ? 'bg-blue-500/20' : 'bg-zinc-800'}`}>
                    <FileImage className={`w-8 h-8 ${isDragging ? 'text-blue-500' : 'text-zinc-500'}`} />
                  </div>
                  
                  <p className="text-center text-zinc-400 text-sm">
                    {!excelLoaded 
                      ? <span className="text-zinc-600">Carica prima il file Excel</span>
                      : isDragging 
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
                      
                      <ScrollArea className="max-h-[150px]">
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
                  disabled={files.length === 0 || processing || !excelLoaded}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium neon-glow disabled:opacity-50 disabled:cursor-not-allowed"
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
                  {mappings.length > 0 && (
                    <span className="ml-2 text-xs font-mono bg-zinc-800 px-2 py-1 rounded text-zinc-400">
                      {mappings.length} righe
                    </span>
                  )}
                </h2>
              </div>

              {!excelLoaded ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="p-4 bg-zinc-800 rounded-full mb-4">
                    <FileSpreadsheet className="w-10 h-10 text-zinc-600" />
                  </div>
                  <p className="text-zinc-500 mb-2">Nessun file Excel caricato</p>
                  <p className="text-xs text-zinc-600">Carica il file "CODICI PRODOTTI.xlsx" per vedere le mappature</p>
                </div>
              ) : (
                <>
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
                </>
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
