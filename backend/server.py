from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import aiohttp
import asyncio
import zipfile
import tempfile
import shutil
import openpyxl
from io import BytesIO
import aiofiles


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

# Base URL for images
IMAGE_BASE_URL = "https://www.borellacasalinghi.it/foto-prodotti/cartella-immagini"
SUPPORTED_FORMATS = [".jpg", ".png", ".webp", ".tif"]

# Define Models
class ImageSearchResult(BaseModel):
    code: str
    found: bool
    image_url: Optional[str] = None
    format: Optional[str] = None
    error: Optional[str] = None

class BatchSearchResult(BaseModel):
    total_codes: int
    found_codes: List[str]
    not_found_codes: List[str]
    results: List[ImageSearchResult]

class SearchRequest(BaseModel):
    code: str

# Helper function to check if image exists
async def check_image_exists(session: aiohttp.ClientSession, url: str) -> bool:
    try:
        # Use GET with range header instead of HEAD for better compatibility
        headers = {'Range': 'bytes=0-1023'}  # Only get first 1KB
        async with session.get(url, headers=headers) as response:
            return response.status in [200, 206]  # 206 for partial content
    except Exception as e:
        logging.error(f"Error checking {url}: {str(e)}")
        return False

# Function to find image for a product code
async def find_product_image(session: aiohttp.ClientSession, code: str) -> ImageSearchResult:
    code = code.strip().upper()
    
    for format_ext in SUPPORTED_FORMATS:
        image_url = f"{IMAGE_BASE_URL}/{code}{format_ext}"
        if await check_image_exists(session, image_url):
            return ImageSearchResult(
                code=code,
                found=True,
                image_url=image_url,
                format=format_ext
            )
    
    return ImageSearchResult(
        code=code,
        found=False,
        error="Immagine non trovata"
    )

@api_router.get("/")
async def root():
    return {"message": "Sistema di Ricerca Immagini Prodotti"}

@api_router.post("/search-single", response_model=ImageSearchResult)
async def search_single_product(request: SearchRequest):
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="Codice prodotto non può essere vuoto")
    
    async with aiohttp.ClientSession() as session:
        result = await find_product_image(session, request.code)
        return result

@api_router.get("/download-image")
async def download_single_image(url: str, filename: str):
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    raise HTTPException(status_code=404, detail="Immagine non trovata")
                
                content = await response.read()
                
                return StreamingResponse(
                    BytesIO(content),
                    media_type="application/octet-stream",
                    headers={"Content-Disposition": f"attachment; filename={filename}"}
                )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nel download: {str(e)}")

@api_router.post("/search-batch", response_model=BatchSearchResult)
async def search_batch_products(file: UploadFile = File(...)):
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Il file deve essere in formato .xlsx")
    
    try:
        # Read Excel file
        contents = await file.read()
        workbook = openpyxl.load_workbook(BytesIO(contents))
        sheet = workbook.active
        
        # Find CODICE column
        codice_col = None
        for col in range(1, sheet.max_column + 1):
            cell_value = sheet.cell(row=1, column=col).value
            if cell_value and str(cell_value).upper() == "CODICE":
                codice_col = col
                break
        
        if codice_col is None:
            raise HTTPException(status_code=400, detail="Colonna 'CODICE' non trovata nel file Excel")
        
        # Extract codes
        codes = []
        for row in range(2, sheet.max_row + 1):
            cell_value = sheet.cell(row=row, column=codice_col).value
            if cell_value:
                codes.append(str(cell_value).strip())
        
        if not codes:
            raise HTTPException(status_code=400, detail="Nessun codice trovato nella colonna CODICE")
        
        # Search for images
        results = []
        found_codes = []
        not_found_codes = []
        
        async with aiohttp.ClientSession() as session:
            tasks = [find_product_image(session, code) for code in codes]
            results = await asyncio.gather(*tasks)
            
            for result in results:
                if result.found:
                    found_codes.append(result.code)
                else:
                    not_found_codes.append(result.code)
        
        return BatchSearchResult(
            total_codes=len(codes),
            found_codes=found_codes,
            not_found_codes=not_found_codes,
            results=results
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nell'elaborazione del file: {str(e)}")

@api_router.post("/download-batch-zip")
async def download_batch_zip(file: UploadFile = File(...)):
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Il file deve essere in formato .xlsx")
    
    try:
        # Read Excel file and extract codes (same logic as above)
        contents = await file.read()
        workbook = openpyxl.load_workbook(BytesIO(contents))
        sheet = workbook.active
        
        codice_col = None
        for col in range(1, sheet.max_column + 1):
            cell_value = sheet.cell(row=1, column=col).value
            if cell_value and str(cell_value).upper() == "CODICE":
                codice_col = col
                break
        
        if codice_col is None:
            raise HTTPException(status_code=400, detail="Colonna 'CODICE' non trovata nel file Excel")
        
        codes = []
        for row in range(2, sheet.max_row + 1):
            cell_value = sheet.cell(row=row, column=codice_col).value
            if cell_value:
                codes.append(str(cell_value).strip())
        
        # Create temporary directory for images
        temp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(temp_dir, "immagini_prodotti.zip")
        
        try:
            async with aiohttp.ClientSession() as session:
                with zipfile.ZipFile(zip_path, 'w') as zip_file:
                    downloaded_count = 0
                    
                    for code in codes:
                        result = await find_product_image(session, code)
                        
                        if result.found and result.image_url:
                            try:
                                async with session.get(result.image_url) as response:
                                    if response.status == 200:
                                        image_content = await response.read()
                                        filename = f"{code}{result.format}"
                                        zip_file.writestr(filename, image_content)
                                        downloaded_count += 1
                            except Exception as e:
                                logging.error(f"Errore nel download di {code}: {str(e)}")
                                continue
                    
                    if downloaded_count == 0:
                        raise HTTPException(status_code=404, detail="Nessuna immagine trovata per i codici forniti")
            
            # Return zip file
            return FileResponse(
                zip_path,
                media_type="application/zip",
                filename="immagini_prodotti.zip",
                background=lambda: shutil.rmtree(temp_dir)
            )
            
        except Exception as e:
            shutil.rmtree(temp_dir)
            raise e
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nell'elaborazione: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()