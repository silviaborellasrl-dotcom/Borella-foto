import React, { useState, useEffect } from "react";
import "./App.css";
import { Search, Download, Upload, AlertCircle, CheckCircle, Loader2, Image as ImageIcon, Clock, TrendingUp } from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Badge } from "./components/ui/badge";
import { Separator } from "./components/ui/separator";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://image-fetch-system.preview.emergentagent.com";
const API = `${BACKEND_URL}/api`;

// Debug: Log the API URL
console.log("API URL:", API);

function App() {
  // Single search state
  const [singleCode, setSingleCode] = useState("");
  const [singleResult, setSingleResult] = useState(null);
  const [singleLoading, setSingleLoading] = useState(false);

  // Batch search state
  const [selectedFile, setSelectedFile] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  
  // Progress tracking state
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [showProgress, setShowProgress] = useState(false);

  // Single product search
  const handleSingleSearch = async () => {
    if (!singleCode.trim()) return;

    setSingleLoading(true);
    try {
      console.log("Making API call to:", `${API}/search-single`);
      const response = await fetch(`${API}/search-single`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: singleCode.trim() })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("API response:", data);
      setSingleResult(data);
    } catch (error) {
      console.error("Errore nella ricerca:", error);
      setSingleResult({
        code: singleCode,
        found: false,
        error: "Errore nella ricerca"
      });
    } finally {
      setSingleLoading(false);
    }
  };

  // Download single image
  const handleSingleDownload = async () => {
    if (!singleResult?.image_url) return;

    try {
      const filename = `${singleResult.code}${singleResult.format}`;
      const response = await fetch(
        `${API}/download-image?url=${encodeURIComponent(singleResult.image_url)}&filename=${encodeURIComponent(filename)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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

  // Handle file selection
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

  // Progress tracking function
  const pollProgress = async (taskId) => {
    try {
      const response = await fetch(`${API}/progress/${taskId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const progress = await response.json();
      setProgressData(progress);
      
      if (progress.status === "completed") {
        // Get final results
        setShowProgress(false);
        setBatchLoading(false);
        
        setBatchResult({
          total_codes: progress.total_items,
          found_codes: progress.found_items || [],
          not_found_codes: progress.not_found_items || [],
          results: [] // Results would be populated from a separate endpoint if needed
        });
        
        setCurrentTaskId(null);
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
        // Continue polling
        setTimeout(() => pollProgress(taskId), 1000);
      }
    } catch (error) {
      console.error("Errore nel polling del progresso:", error);
      setShowProgress(false);
      setBatchLoading(false);
      setCurrentTaskId(null);
    }
  };

  // Batch search function with progress tracking
  const handleBatchSearch = async () => {
    if (!selectedFile) return;

    setBatchLoading(true);
    setShowProgress(true);
    setBatchResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Start async batch processing
      const response = await fetch(`${API}/search-batch-async`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.task_id) {
        setCurrentTaskId(data.task_id);
        // Start polling for progress
        pollProgress(data.task_id);
      } else {
        throw new Error("Task ID non ricevuto");
      }
    } catch (error) {
      console.error("Errore nella ricerca batch:", error);
      setBatchResult({
        total_codes: 0,
        found_codes: [],
        not_found_codes: [],
        error: "Errore nell'avvio dell'elaborazione"
      });
      setBatchLoading(false);
      setShowProgress(false);
    }
  };

  // Download batch ZIP function (updated for progress tracking)
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
      console.error("Errore nel download ZIP:", error);
      alert("Errore nel download del file ZIP");
    } finally {
      setDownloadLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-800">Sistema Ricerca Immagini</h1>
          </div>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            Cerca e scarica immagini prodotti utilizzando codici singoli o caricando file Excel
          </p>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="single" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Ricerca Singola
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Ricerca Multipla
            </TabsTrigger>
          </TabsList>

          {/* Single Search Tab */}
          <TabsContent value="single">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Search className="w-5 h-5 text-blue-600" />
                  Ricerca Immagine Singola
                </CardTitle>
                <CardDescription>
                  Inserisci un codice prodotto per cercare l'immagine corrispondente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-3">
                  <Input
                    placeholder="Inserisci codice prodotto..."
                    value={singleCode}
                    onChange={(e) => setSingleCode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSingleSearch()}
                    className="flex-1 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <Button 
                    onClick={handleSingleSearch}
                    disabled={!singleCode.trim() || singleLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                  >
                    {singleLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Cerca
                  </Button>
                </div>

                {singleResult && (
                  <div className="mt-6">
                    {singleResult.found ? (
                      <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                        <div className="flex items-center gap-2 mb-4">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="text-green-800 font-medium">Immagine trovata!</span>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {singleResult.format}
                          </Badge>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm text-slate-600 mb-2">Codice:</p>
                              <p className="font-mono font-semibold text-slate-800">{singleResult.code}</p>
                            </div>
                            <Button 
                              onClick={handleSingleDownload}
                              className="w-full bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Scarica Immagine
                            </Button>
                          </div>
                          
                          <div className="flex items-center justify-center">
                            <div className="w-full max-w-sm bg-white rounded-lg shadow-md overflow-hidden">
                              <img
                                src={singleResult.image_url}
                                alt={`Prodotto ${singleResult.code}`}
                                className="w-full h-48 object-cover"
                                onError={(e) => {
                                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik02MCA2MEgxNDBWMTQwSDYwVjYwWiIgZmlsbD0iI0Q1RDdEQSIvPgo8L3N2Zz4K';
                                }}
                              />
                              <div className="p-3">
                                <p className="text-sm text-slate-600 text-center">Anteprima immagine</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Alert className="border-red-200 bg-red-50">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                          <strong>Codice: {singleResult.code}</strong><br />
                          {singleResult.error || 'Immagine non trovata'}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Batch Search Tab */}
          <TabsContent value="batch">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Upload className="w-5 h-5 text-blue-600" />
                  Ricerca Multipla da Excel
                </CardTitle>
                <CardDescription>
                  Carica un file Excel con la colonna "CODICE" o "COD.PR" per cercare più immagini contemporaneamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Input
                      type="file"
                      accept=".xlsx"
                      onChange={handleFileSelect}
                      className="border-slate-200 focus:border-blue-500"
                    />
                    <p className="text-sm text-slate-500 mt-2">
                      Formato supportato: .xlsx con colonna "CODICE" o "COD.PR"
                    </p>
                  </div>

                  {selectedFile && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <p className="text-blue-800 font-medium">File selezionato:</p>
                      <p className="text-blue-700">{selectedFile.name}</p>
                    </div>
                  )}

                  {/* Progress Bar Component */}
                  {showProgress && progressData && (
                    <div className="bg-blue-50 rounded-lg p-6 border border-blue-200 mb-6">
                      <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        <span className="text-blue-800 font-medium">Elaborazione in corso...</span>
                        <div className="flex items-center gap-1 ml-auto">
                          <Clock className="w-4 h-4 text-blue-600" />
                          <span className="text-blue-700 text-sm">{progressData.elapsed_time}</span>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-700">
                            {progressData.completed_items} di {progressData.total_items} codici elaborati
                          </span>
                          <span className="text-blue-700 font-semibold">
                            {progressData.progress_percentage}%
                          </span>
                        </div>
                        
                        <div className="w-full bg-blue-100 rounded-full h-3 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out relative"
                            style={{ width: `${progressData.progress_percentage}%` }}
                          >
                            <div className="absolute inset-0 bg-white bg-opacity-20 animate-pulse"></div>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center text-sm">
                          <div className="text-blue-700">
                            <strong>Attuale:</strong> {progressData.current_item}
                          </div>
                          <div className="flex gap-4">
                            <span className="text-green-600">
                              ✅ Trovati: {progressData.found_count}
                            </span>
                            <span className="text-orange-600">
                              ❌ Non trovati: {progressData.not_found_count}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button 
                      onClick={handleBatchSearch}
                      disabled={!selectedFile || batchLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {batchLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Search className="w-4 h-4 mr-2" />
                      )}
                      Analizza File
                    </Button>

                    {batchResult && batchResult.found_codes?.length > 0 && (
                      <Button 
                        onClick={handleBatchDownload}
                        disabled={downloadLoading}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {downloadLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Download className="w-4 h-4 mr-2" />
                        )}
                        Scarica ZIP
                      </Button>
                    )}
                    
                    {/* Alternative: Show download button when progress is completed with found items */}
                    {!batchResult && progressData && progressData.status === "completed" && progressData.found_count > 0 && (
                      <Button 
                        onClick={handleBatchDownload}
                        disabled={downloadLoading}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {downloadLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Download className="w-4 h-4 mr-2" />
                        )}
                        Scarica ZIP ({progressData.found_count} immagini)
                      </Button>
                    )}
                  </div>
                </div>

                {batchResult && (
                  <div className="space-y-4">
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="border-slate-200">
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-slate-800">{batchResult.total_codes}</p>
                          <p className="text-sm text-slate-600">Codici totali</p>
                        </CardContent>
                      </Card>
                      <Card className="border-green-200 bg-green-50">
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-green-700">{batchResult.found_codes?.length || 0}</p>
                          <p className="text-sm text-green-600">Immagini trovate</p>
                        </CardContent>
                      </Card>
                      <Card className="border-red-200 bg-red-50">
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-red-700">{batchResult.not_found_codes?.length || 0}</p>
                          <p className="text-sm text-red-600">Non trovate</p>
                        </CardContent>
                      </Card>
                    </div>

                    {batchResult.not_found_codes?.length > 0 && (
                      <Alert className="border-amber-200 bg-amber-50">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-800">
                          <strong>Codici non trovati:</strong><br />
                          <div className="flex flex-wrap gap-1 mt-2">
                            {batchResult.not_found_codes.map((code, index) => (
                              <Badge key={index} variant="secondary" className="bg-amber-100 text-amber-800">
                                {code}
                              </Badge>
                            ))}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {batchResult.found_codes?.length > 0 && (
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <p className="text-green-800 font-medium mb-2">Immagini disponibili per il download:</p>
                        <div className="flex flex-wrap gap-1">
                          {batchResult.found_codes.map((code, index) => (
                            <Badge key={index} className="bg-green-100 text-green-800">
                              {code}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center mt-12 text-slate-600">
          <p className="text-sm">
            Sistema per la ricerca e download immagini prodotti • Borella Casalinghi
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;