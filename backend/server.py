from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Optional
import uuid
from datetime import datetime, timezone
import httpx
from openpyxl import load_workbook
from io import BytesIO
import zipfile
import tempfile

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

class ProcessResponse(BaseModel):
    results: List[RenameResult]
    success_count: int
    error_count: int
    zip_ready: bool

# Cache for Excel mappings
excel_cache: Dict[str, str] = {}
cache_timestamp: Optional[datetime] = None

async def fetch_excel_mappings(force_refresh: bool = False) -> Dict[str, str]:
    """Fetch and parse Excel file from remote URL"""
    global excel_cache, cache_timestamp
    
    # Use cache if available and less than 5 minutes old
    if not force_refresh and cache_timestamp and excel_cache:
        age = (datetime.now(timezone.utc) - cache_timestamp).total_seconds()
        if age < 300:  # 5 minutes
            return excel_cache
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(EXCEL_URL)
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
        
        excel_cache = mappings
        cache_timestamp = datetime.now(timezone.utc)
        
        logger.info(f"Loaded {len(mappings)} mappings from Excel")
        return mappings
        
    except Exception as e:
        logger.error(f"Error fetching Excel file: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nel caricamento del file Excel: {str(e)}")

@api_router.get("/")
async def root():
    return {"message": "Photo Renamer API"}

@api_router.get("/excel-mapping", response_model=ExcelMappingResponse)
async def get_excel_mappings(refresh: bool = False):
    """Get all mappings from Excel file"""
    mappings = await fetch_excel_mappings(force_refresh=refresh)
    
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
    
    # Get Excel mappings
    mappings = await fetch_excel_mappings()
    
    if not mappings:
        raise HTTPException(status_code=400, detail="Nessuna mappatura trovata nel file Excel")
    
    results: List[RenameResult] = []
    renamed_files: List[tuple] = []  # (new_name, content)
    
    for file in files:
        original_name = file.filename
        # Get file extension
        name_parts = original_name.rsplit('.', 1)
        base_name = name_parts[0] if len(name_parts) > 1 else original_name
        extension = name_parts[1] if len(name_parts) > 1 else ''
        
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
    
    # Store renamed files in session for download
    if renamed_files:
        session_id = str(uuid.uuid4())
        # Store in MongoDB temporarily
        await db.temp_files.insert_one({
            "session_id": session_id,
            "files": [(name, content) for name, content in renamed_files],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "results": [r.model_dump() for r in results],
            "success_count": success_count,
            "error_count": error_count,
            "zip_ready": success_count > 0,
            "session_id": session_id
        }
    
    return {
        "results": [r.model_dump() for r in results],
        "success_count": success_count,
        "error_count": error_count,
        "zip_ready": False,
        "session_id": None
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
        for name, content in files:
            # Content is stored as list in MongoDB, convert back to bytes
            if isinstance(content, list):
                content = bytes(content)
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
