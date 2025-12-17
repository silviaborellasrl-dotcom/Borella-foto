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

# In-memory cache for Excel mappings (per session)
excel_cache: Dict[str, str] = {}
cache_session_id: Optional[str] = None

@api_router.get("/")
async def root():
    return {"message": "Photo Renamer API"}

@api_router.post("/upload-excel", response_model=ExcelMappingResponse)
async def upload_excel(file: UploadFile = File(...)):
    """Upload and parse Excel file"""
    global excel_cache, cache_session_id
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Il file deve essere un Excel (.xlsx o .xls)")
    
    try:
        content = await file.read()
        wb = load_workbook(filename=BytesIO(content), read_only=True)
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
        cache_session_id = str(uuid.uuid4())
        
        # Save to MongoDB for persistence
        await db.excel_mappings.delete_many({})
        if mappings:
            docs = [{"codice": k, "cod_prodotto": v} for k, v in mappings.items()]
            await db.excel_mappings.insert_many(docs)
        
        logger.info(f"Loaded {len(mappings)} mappings from Excel")
        
        mapping_list = [
            ExcelMapping(codice=k, cod_prodotto=v) 
            for k, v in mappings.items()
        ]
        
        return ExcelMappingResponse(
            mappings=mapping_list,
            total=len(mapping_list)
        )
        
    except Exception as e:
        logger.error(f"Error parsing Excel file: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nel parsing del file Excel: {str(e)}")

@api_router.get("/excel-mapping", response_model=ExcelMappingResponse)
async def get_excel_mappings():
    """Get current mappings from cache or database"""
    global excel_cache
    
    # Try cache first
    if excel_cache:
        mapping_list = [
            ExcelMapping(codice=k, cod_prodotto=v) 
            for k, v in excel_cache.items()
        ]
        return ExcelMappingResponse(
            mappings=mapping_list,
            total=len(mapping_list)
        )
    
    # Try database
    cursor = db.excel_mappings.find({}, {"_id": 0})
    docs = await cursor.to_list(10000)
    
    if docs:
        excel_cache = {doc["codice"]: doc["cod_prodotto"] for doc in docs}
        mapping_list = [
            ExcelMapping(codice=doc["codice"], cod_prodotto=doc["cod_prodotto"]) 
            for doc in docs
        ]
        return ExcelMappingResponse(
            mappings=mapping_list,
            total=len(mapping_list)
        )
    
    return ExcelMappingResponse(mappings=[], total=0)

@api_router.post("/process-images")
async def process_images(files: List[UploadFile] = File(...)):
    """Process uploaded images and create ZIP with renamed files"""
    global excel_cache
    
    # Get mappings from cache or database
    if not excel_cache:
        cursor = db.excel_mappings.find({}, {"_id": 0})
        docs = await cursor.to_list(10000)
        if docs:
            excel_cache = {doc["codice"]: doc["cod_prodotto"] for doc in docs}
    
    if not excel_cache:
        raise HTTPException(status_code=400, detail="Nessuna mappatura Excel caricata. Carica prima il file Excel.")
    
    results: List[RenameResult] = []
    renamed_files: List[tuple] = []  # (new_name, content)
    
    for file in files:
        original_name = file.filename
        # Get file extension
        name_parts = original_name.rsplit('.', 1)
        base_name = name_parts[0] if len(name_parts) > 1 else original_name
        extension = name_parts[1].lower() if len(name_parts) > 1 else ''
        
        # Check if base name exists in mappings
        if base_name in excel_cache:
            new_base_name = excel_cache[base_name]
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
        # Store files as base64 to avoid binary issues
        import base64
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
    import base64
    
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

@api_router.delete("/clear-mappings")
async def clear_mappings():
    """Clear all mappings"""
    global excel_cache
    excel_cache = {}
    await db.excel_mappings.delete_many({})
    return {"message": "Mappature cancellate"}

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
