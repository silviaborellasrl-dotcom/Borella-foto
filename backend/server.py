from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Dict, Optional
import uuid
from datetime import datetime, timezone
import httpx
from openpyxl import load_workbook
from io import BytesIO
import zipfile
import base64
import hashlib

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
    last_updated: Optional[str] = None
    file_hash: Optional[str] = None

class ExcelStatusResponse(BaseModel):
    status: str
    total_mappings: int
    last_updated: Optional[str] = None
    file_hash: Optional[str] = None
    needs_update: bool
    message: str

class RenameResult(BaseModel):
    original_name: str
    new_name: str
    status: str
    message: Optional[str] = None

# In-memory cache for Excel mappings
excel_cache: Dict[str, str] = {}
cache_file_hash: Optional[str] = None
cache_last_updated: Optional[str] = None

def get_browser_headers():
    """Get browser-like headers for HTTP requests"""
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*",
        "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://www.borellacasalinghi.it/",
    }

def compute_file_hash(content: bytes) -> str:
    """Compute MD5 hash of file content"""
    return hashlib.md5(content).hexdigest()

async def check_excel_update() -> dict:
    """Check if Excel file has been updated without downloading full content"""
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as http_client:
            # Try HEAD request first for efficiency
            response = await http_client.head(EXCEL_URL, headers=get_browser_headers())
            
            last_modified = response.headers.get("Last-Modified")
            content_length = response.headers.get("Content-Length")
            etag = response.headers.get("ETag")
            
            return {
                "success": True,
                "last_modified": last_modified,
                "content_length": content_length,
                "etag": etag
            }
    except Exception as e:
        logger.warning(f"HEAD request failed, will use GET: {e}")
        return {"success": False, "error": str(e)}

async def fetch_and_parse_excel() -> tuple[Dict[str, str], str, str]:
    """Fetch Excel file and parse mappings, returns (mappings, hash, timestamp)"""
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
            response = await http_client.get(EXCEL_URL, headers=get_browser_headers())
            response.raise_for_status()
        
        content = response.content
        file_hash = compute_file_hash(content)
        
        # Load workbook from bytes
        wb = load_workbook(filename=BytesIO(content), read_only=True)
        ws = wb.active
        
        mappings = {}
        for row in ws.iter_rows(min_row=2, values_only=True):
            if row[0] and row[1]:
                codice = str(row[0]).strip()
                cod_prodotto = str(row[1]).strip()
                mappings[codice] = cod_prodotto
        
        wb.close()
        
        timestamp = datetime.now(timezone.utc).isoformat()
        
        return mappings, file_hash, timestamp
        
    except Exception as e:
        logger.error(f"Error fetching Excel file: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nel download del file Excel: {str(e)}")

async def load_mappings_from_db() -> tuple[Dict[str, str], str, str]:
    """Load mappings from database"""
    # Get metadata
    meta = await db.excel_metadata.find_one({"_id": "current"}, {"_id": 0})
    
    if not meta:
        return {}, None, None
    
    # Get mappings
    cursor = db.excel_mappings.find({}, {"_id": 0})
    docs = await cursor.to_list(10000)
    
    mappings = {doc["codice"]: doc["cod_prodotto"] for doc in docs}
    
    return mappings, meta.get("file_hash"), meta.get("last_updated")

async def save_mappings_to_db(mappings: Dict[str, str], file_hash: str, timestamp: str):
    """Save mappings and metadata to database"""
    # Save metadata
    await db.excel_metadata.update_one(
        {"_id": "current"},
        {"$set": {
            "file_hash": file_hash,
            "last_updated": timestamp,
            "total_mappings": len(mappings)
        }},
        upsert=True
    )
    
    # Save mappings
    await db.excel_mappings.delete_many({})
    if mappings:
        docs = [{"codice": k, "cod_prodotto": v} for k, v in mappings.items()]
        await db.excel_mappings.insert_many(docs)

async def ensure_mappings_loaded(force_refresh: bool = False) -> tuple[Dict[str, str], str, str]:
    """Ensure mappings are loaded, checking for updates"""
    global excel_cache, cache_file_hash, cache_last_updated
    
    # If force refresh, always download
    if force_refresh:
        logger.info("Force refresh requested, downloading Excel file...")
        mappings, file_hash, timestamp = await fetch_and_parse_excel()
        await save_mappings_to_db(mappings, file_hash, timestamp)
        excel_cache = mappings
        cache_file_hash = file_hash
        cache_last_updated = timestamp
        logger.info(f"Excel updated: {len(mappings)} mappings, hash: {file_hash[:8]}...")
        return mappings, file_hash, timestamp
    
    # If cache is empty, try loading from DB
    if not excel_cache:
        mappings, file_hash, timestamp = await load_mappings_from_db()
        if mappings:
            excel_cache = mappings
            cache_file_hash = file_hash
            cache_last_updated = timestamp
            logger.info(f"Loaded {len(mappings)} mappings from database")
    
    # If still no mappings, fetch from URL
    if not excel_cache:
        logger.info("No cached mappings, downloading Excel file...")
        mappings, file_hash, timestamp = await fetch_and_parse_excel()
        await save_mappings_to_db(mappings, file_hash, timestamp)
        excel_cache = mappings
        cache_file_hash = file_hash
        cache_last_updated = timestamp
        logger.info(f"Excel loaded: {len(mappings)} mappings, hash: {file_hash[:8]}...")
    
    return excel_cache, cache_file_hash, cache_last_updated

async def check_and_update_if_needed() -> dict:
    """Check if Excel file has changed and update if needed"""
    global excel_cache, cache_file_hash, cache_last_updated
    
    try:
        # Download and compute hash
        mappings, new_hash, timestamp = await fetch_and_parse_excel()
        
        # Compare with cached hash
        if cache_file_hash and new_hash == cache_file_hash:
            return {
                "updated": False,
                "message": "File Excel non modificato",
                "total_mappings": len(excel_cache),
                "file_hash": cache_file_hash
            }
        
        # File has changed, update
        old_count = len(excel_cache) if excel_cache else 0
        await save_mappings_to_db(mappings, new_hash, timestamp)
        excel_cache = mappings
        cache_file_hash = new_hash
        cache_last_updated = timestamp
        
        new_count = len(mappings)
        diff = new_count - old_count
        
        logger.info(f"Excel updated: {new_count} mappings (diff: {diff:+d}), new hash: {new_hash[:8]}...")
        
        return {
            "updated": True,
            "message": f"File Excel aggiornato! {new_count} mappature ({diff:+d} rispetto a prima)",
            "total_mappings": new_count,
            "file_hash": new_hash,
            "previous_count": old_count,
            "difference": diff
        }
        
    except Exception as e:
        logger.error(f"Error checking Excel update: {e}")
        return {
            "updated": False,
            "message": f"Errore nel controllo aggiornamenti: {str(e)}",
            "error": True
        }

@api_router.get("/")
async def root():
    return {"message": "Photo Renamer API"}

@api_router.get("/excel-status", response_model=ExcelStatusResponse)
async def get_excel_status():
    """Get current Excel file status and check for updates"""
    global excel_cache, cache_file_hash, cache_last_updated
    
    # Ensure we have mappings loaded
    await ensure_mappings_loaded()
    
    # Check for updates
    result = await check_and_update_if_needed()
    
    return ExcelStatusResponse(
        status="ok" if not result.get("error") else "error",
        total_mappings=result.get("total_mappings", len(excel_cache)),
        last_updated=cache_last_updated,
        file_hash=cache_file_hash,
        needs_update=result.get("updated", False),
        message=result.get("message", "")
    )

@api_router.get("/excel-mapping", response_model=ExcelMappingResponse)
async def get_excel_mappings(refresh: bool = False, check_update: bool = True):
    """Get mappings from Excel file, optionally checking for updates"""
    global excel_cache, cache_file_hash, cache_last_updated
    
    if refresh:
        # Force download new version
        await ensure_mappings_loaded(force_refresh=True)
    elif check_update:
        # Check if file has been updated
        await check_and_update_if_needed()
    else:
        # Just ensure mappings are loaded
        await ensure_mappings_loaded()
    
    mapping_list = [
        ExcelMapping(codice=k, cod_prodotto=v) 
        for k, v in excel_cache.items()
    ]
    
    return ExcelMappingResponse(
        mappings=mapping_list,
        total=len(mapping_list),
        last_updated=cache_last_updated,
        file_hash=cache_file_hash
    )

@api_router.post("/check-excel-update")
async def check_excel_update_endpoint():
    """Manually trigger Excel update check"""
    result = await check_and_update_if_needed()
    return result

@api_router.post("/process-images")
async def process_images(files: List[UploadFile] = File(...)):
    """Process uploaded images and create ZIP with renamed files"""
    
    # Ensure mappings are loaded and up to date
    await ensure_mappings_loaded()
    
    if not excel_cache:
        raise HTTPException(status_code=400, detail="Nessuna mappatura Excel disponibile.")
    
    results: List[RenameResult] = []
    renamed_files: List[tuple] = []
    
    for file in files:
        original_name = file.filename
        name_parts = original_name.rsplit('.', 1)
        base_name = name_parts[0] if len(name_parts) > 1 else original_name
        extension = name_parts[1].lower() if len(name_parts) > 1 else ''
        
        if base_name in excel_cache:
            new_base_name = excel_cache[base_name]
            new_name = f"{new_base_name}.{extension}" if extension else new_base_name
            
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
    
    session_data = await db.temp_files.find_one({"session_id": session_id}, {"_id": 0})
    
    if not session_data:
        raise HTTPException(status_code=404, detail="Sessione non trovata o scaduta")
    
    files = session_data.get("files", [])
    
    if not files:
        raise HTTPException(status_code=404, detail="Nessun file da scaricare")
    
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for name, content_b64 in files:
            content = base64.b64decode(content_b64)
            zip_file.writestr(name, content)
    
    zip_buffer.seek(0)
    
    await db.temp_files.delete_one({"session_id": session_id})
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=foto_rinominate_{session_id[:8]}.zip"
        }
    )

# Startup event to check Excel on app start
@app.on_event("startup")
async def startup_check_excel():
    """Check and load Excel file on startup"""
    logger.info("Starting Photo Renamer API...")
    try:
        result = await check_and_update_if_needed()
        if result.get("updated"):
            logger.info(f"Excel aggiornato all'avvio: {result.get('message')}")
        else:
            # Ensure mappings are at least loaded
            await ensure_mappings_loaded()
            logger.info(f"Excel caricato: {len(excel_cache)} mappature")
    except Exception as e:
        logger.error(f"Error during startup Excel check: {e}")

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
