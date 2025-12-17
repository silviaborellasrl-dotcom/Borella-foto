from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import uuid
from datetime import datetime, timezone
import httpx
from openpyxl import load_workbook
from io import BytesIO
import zipfile
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Excel URL
EXCEL_URL = "https://www.borellacasalinghi.it/foto-prodotti/cartella-immagini/CODICI%20PRODOTTI.xlsx"

# Define Models
class ExcelMapping(BaseModel):
    codice: str
    cod_prodotto: str

class ExcelMappingResponse(BaseModel):
    mappings: List[ExcelMapping]
    total: int

class RenameResult(BaseModel):
    original_name: str
    new_name: str
    status: str
    message: Optional[str] = None

# In-memory cache for Excel mappings
excel_cache: Dict[str, str] = {}
cache_timestamp: Optional[datetime] = None

async def fetch_excel_from_url() -> Dict[str, str]:
    """Fetch and parse Excel file from remote URL"""
    global excel_cache, cache_timestamp
    
    # Use cache if available and less than 10 minutes old
    if cache_timestamp and excel_cache:
        age = (datetime.now(timezone.utc) - cache_timestamp).total_seconds()
        if age < 600:  # 10 minutes
            return excel_cache
    
    # Check database first
    cursor = db.excel_mappings.find({}, {"_id": 0})
    docs = await cursor.to_list(10000)
    if docs:
        excel_cache = {doc["codice"]: doc["cod_prodotto"] for doc in docs}
        cache_timestamp = datetime.now(timezone.utc)
        return excel_cache
    
    # Try to fetch from URL with browser-like headers
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*",
        "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://www.borellacasalinghi.it/",
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
            response = await http_client.get(EXCEL_URL, headers=headers)
            response.raise_for_status()
            
        # Load workbook from bytes
        wb = load_workbook(filename=BytesIO(response.content), read_only=True)
        ws = wb.active
        
        mappings = {}
        # Skip header row, iterate through data
        for row in ws.iter_rows(min_row=2, values_only=True):
            if row[0] and row[1]:  # CODICE and COD PRODOTTO
                codice = str(row[0]).strip()
                cod_prodotto = str(row[1]).strip()
                mappings[codice] = cod_prodotto
        
        wb.close()
        
        # Save to database for persistence
        if mappings:
            await db.excel_mappings.delete_many({})
            docs = [{"codice": k, "cod_prodotto": v} for k, v in mappings.items()]
            await db.excel_mappings.insert_many(docs)
        
        excel_cache = mappings
        cache_timestamp = datetime.now(timezone.utc)
        
        logger.info(f"Loaded {len(mappings)} mappings from Excel URL")
        return mappings
        
    except Exception as e:
        logger.error(f"Error fetching Excel file: {e}")
        # Return empty if no cached data
        return excel_cache if excel_cache else {}

@api_router.get("/")
async def root():
    return {"message": "Photo Renamer API"}

@api_router.get("/excel-mapping", response_model=ExcelMappingResponse)
async def get_excel_mappings(refresh: bool = False):
    """Get mappings from Excel file"""
    global excel_cache, cache_timestamp
    
    if refresh:
        cache_timestamp = None
        excel_cache = {}
        await db.excel_mappings.delete_many({})
    
    mappings = await fetch_excel_from_url()
    
    mapping_list = [
        ExcelMapping(codice=k, cod_prodotto=v) 
        for k, v in mappings.items()
    ]
    
    return ExcelMappingResponse(
        mappings=mapping_list,
        total=len(mapping_list)
    )

@api_router.post("/process-images")
async def process_images(files: List[UploadFile] = File(...)):
    """Process uploaded images and create ZIP with renamed files"""
    
    # Get mappings
    mappings = await fetch_excel_from_url()
    
    if not mappings:
        raise HTTPException(status_code=400, detail="Nessuna mappatura Excel disponibile. Controlla la connessione al file Excel.")
    
    results: List[RenameResult] = []
    renamed_files: List[tuple] = []  # (new_name, content)
    
    for file in files:
        original_name = file.filename
        # Get file extension
        name_parts = original_name.rsplit('.', 1)
        base_name = name_parts[0] if len(name_parts) > 1 else original_name
        extension = name_parts[1].lower() if len(name_parts) > 1 else ''
        
        # Check if base name exists in mappings
        if base_name in mappings:
            new_base_name = mappings[base_name]
            new_name = f"{new_base_name}.{extension}" if extension else new_base_name
            
            # Read file content
            content = await file.read()
            renamed_files.append((new_name, content))
            
            results.append(RenameResult(
                original_name=original_name,
                new_name=new_name,
                status="success",
                message="Rinominato con successo"
            ))
        else:
            results.append(RenameResult(
                original_name=original_name,
                new_name=original_name,
                status="error",
                message=f"Codice '{base_name}' non trovato nel file Excel"
            ))
    
    success_count = len([r for r in results if r.status == "success"])
    error_count = len([r for r in results if r.status == "error"])
    
    # Store renamed files in MongoDB temporarily
    session_id = None
    if renamed_files:
        session_id = str(uuid.uuid4())
        files_data = [(name, base64.b64encode(content).decode('utf-8')) for name, content in renamed_files]
        
        await db.temp_files.insert_one({
            "session_id": session_id,
            "files": files_data,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {
        "results": [r.model_dump() for r in results],
        "success_count": success_count,
        "error_count": error_count,
        "zip_ready": success_count > 0,
        "session_id": session_id
    }

@api_router.get("/download-zip/{session_id}")
async def download_zip(session_id: str):
    """Download ZIP file with renamed images"""
    
    # Get files from MongoDB
    session_data = await db.temp_files.find_one({"session_id": session_id}, {"_id": 0})
    
    if not session_data:
        raise HTTPException(status_code=404, detail="Sessione non trovata o scaduta")
    
    files = session_data.get("files", [])
    
    if not files:
        raise HTTPException(status_code=404, detail="Nessun file da scaricare")
    
    # Create ZIP in memory
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for name, content_b64 in files:
            content = base64.b64decode(content_b64)
            zip_file.writestr(name, content)
    
    zip_buffer.seek(0)
    
    # Clean up temp files
    await db.temp_files.delete_one({"session_id": session_id})
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=foto_rinominate_{session_id[:8]}.zip"
        }
    )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
