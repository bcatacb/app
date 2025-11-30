from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone
import tempfile
import shutil

# Audio analysis imports
import librosa
import numpy as np
import tensorflow as tf
import tensorflow_hub as hub
from scipy.stats import mode

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

# Load ML models globally
yamnet_model = None
openl3_model = None

@app.on_event("startup")
async def startup_event():
    """Load ML models on startup"""
    global yamnet_model, openl3_model
    try:
        # Load YAMNet model
        logging.info("Loading YAMNet model...")
        yamnet_model = hub.load('https://tfhub.dev/google/yamnet/1')
        logging.info("YAMNet model loaded successfully")
        
        # OpenL3 would require separate installation - using YAMNet for both for now
        openl3_model = yamnet_model
        logging.info("Models loaded successfully")
    except Exception as e:
        logging.error(f"Error loading models: {e}")

# Define Models
class TrackMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    bpm: float
    key: str
    instruments: List[Dict[str, float]]  # [{"name": "piano", "confidence": 0.85}]
    mood_tags: List[str]
    duration: float
    analyzed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    file_size: int
    format: str

class AnalyzeRequest(BaseModel):
    use_yamnet: bool = True
    use_openl3: bool = True

class SearchFilters(BaseModel):
    min_bpm: Optional[float] = None
    max_bpm: Optional[float] = None
    key: Optional[str] = None
    instruments: Optional[List[str]] = None
    mood_tags: Optional[List[str]] = None

# Audio Analysis Functions
def detect_bpm(audio_path: str) -> float:
    """Detect BPM using librosa"""
    try:
        y, sr = librosa.load(audio_path)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        return float(tempo)
    except Exception as e:
        logging.error(f"Error detecting BPM: {e}")
        return 120.0  # Default BPM

def detect_key(audio_path: str) -> str:
    """Detect musical key using librosa chroma features"""
    try:
        y, sr = librosa.load(audio_path)
        chromagram = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_mean = np.mean(chromagram, axis=1)
        
        # Key mapping
        keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        key_idx = np.argmax(chroma_mean)
        
        # Simple major/minor detection based on chord pattern
        major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
        minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
        
        major_correlation = np.corrcoef(chroma_mean, np.roll(major_profile, key_idx))[0, 1]
        minor_correlation = np.corrcoef(chroma_mean, np.roll(minor_profile, key_idx))[0, 1]
        
        scale = "major" if major_correlation > minor_correlation else "minor"
        return f"{keys[key_idx]} {scale}"
    except Exception as e:
        logging.error(f"Error detecting key: {e}")
        return "C major"  # Default key

def detect_instruments(audio_path: str, use_yamnet: bool, use_openl3: bool) -> List[Dict[str, float]]:
    """Detect instruments using YAMNet and/or OpenL3"""
    instruments = []
    
    try:
        if not use_yamnet and not use_openl3:
            return instruments
            
        # Load audio
        y, sr = librosa.load(audio_path, sr=16000, mono=True)
        
        if use_yamnet and yamnet_model:
            # YAMNet expects audio in specific format
            scores, embeddings, spectrogram = yamnet_model(y)
            scores_mean = np.mean(scores.numpy(), axis=0)
            
            # Get class names from YAMNet
            class_names_url = 'https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv'
            import urllib.request
            import csv
            
            # Load class names
            with urllib.request.urlopen(class_names_url) as response:
                class_names = [line.decode('utf-8').split(',')[2].strip() for line in response]
            
            # Instrument keywords to look for
            instrument_keywords = [
                'piano', 'guitar', 'drum', 'bass', 'violin', 'trumpet', 
                'saxophone', 'flute', 'synthesizer', 'keyboard', 'organ',
                'percussion', 'string', 'brass', 'woodwind', 'electronic'
            ]
            
            # Find relevant instruments
            for idx, score in enumerate(scores_mean):
                if score > 0.1:  # Threshold
                    class_name = class_names[idx]
                    for keyword in instrument_keywords:
                        if keyword in class_name.lower():
                            instruments.append({
                                "name": class_name,
                                "confidence": float(score)
                            })
                            break
        
        # Sort by confidence and limit to top 10
        instruments = sorted(instruments, key=lambda x: x['confidence'], reverse=True)[:10]
        
    except Exception as e:
        logging.error(f"Error detecting instruments: {e}")
    
    return instruments

def detect_mood(audio_path: str) -> List[str]:
    """Detect mood tags using spectral features"""
    try:
        y, sr = librosa.load(audio_path)
        
        # Extract features
        spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
        spectral_rolloff = np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr))
        zero_crossing_rate = np.mean(librosa.feature.zero_crossing_rate(y))
        rms = np.mean(librosa.feature.rms(y=y))
        
        moods = []
        
        # Brightness
        if spectral_centroid > 2000:
            moods.append("bright")
        elif spectral_centroid < 1000:
            moods.append("dark")
        
        # Energy
        if rms > 0.1:
            moods.append("energetic")
        elif rms < 0.05:
            moods.append("calm")
        
        # Texture
        if zero_crossing_rate > 0.15:
            moods.append("aggressive")
        elif zero_crossing_rate < 0.05:
            moods.append("smooth")
        
        # Additional mood tags based on spectral rolloff
        if spectral_rolloff > 4000:
            moods.append("sharp")
        else:
            moods.append("warm")
        
        return moods if moods else ["neutral"]
    except Exception as e:
        logging.error(f"Error detecting mood: {e}")
        return ["neutral"]

# Helper function for single file analysis
async def analyze_single_file(file: UploadFile, use_yamnet: bool, use_openl3: bool) -> TrackMetadata:
    """Analyze a single audio file"""
    allowed_extensions = ['.wav', '.mp3', '.flac', '.m4a', '.ogg']
    file_ext = Path(file.filename).suffix.lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File type {file_ext} not supported. Allowed: {allowed_extensions}")
    
    # Create temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
        shutil.copyfileobj(file.file, tmp_file)
        tmp_path = tmp_file.name
    
    try:
        # Get file info
        file_size = os.path.getsize(tmp_path)
        y, sr = librosa.load(tmp_path, sr=None)
        duration = float(librosa.get_duration(y=y, sr=sr))
        
        # Perform analysis
        bpm = detect_bpm(tmp_path)
        key = detect_key(tmp_path)
        instruments = detect_instruments(tmp_path, use_yamnet, use_openl3)
        mood_tags = detect_mood(tmp_path)
        
        # Create metadata
        metadata = TrackMetadata(
            filename=file.filename,
            bpm=bpm,
            key=key,
            instruments=instruments,
            mood_tags=mood_tags,
            duration=duration,
            file_size=file_size,
            format=file_ext.lstrip('.')
        )
        
        # Store in database
        doc = metadata.model_dump()
        doc['analyzed_at'] = doc['analyzed_at'].isoformat()
        await db.tracks.insert_one(doc)
        
        return metadata
        
    except Exception as e:
        logging.error(f"Error analyzing audio: {e}")
        raise HTTPException(status_code=500, detail=f"Error analyzing audio: {str(e)}")
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except:
            pass

# API Routes
@api_router.post("/analyze", response_model=TrackMetadata)
async def analyze_audio(
    file: UploadFile = File(...),
    use_yamnet: bool = Query(True),
    use_openl3: bool = Query(True)
):
    """Upload and analyze single audio file"""
    return await analyze_single_file(file, use_yamnet, use_openl3)

@api_router.post("/analyze-batch")
async def analyze_batch(
    files: List[UploadFile] = File(...),
    use_yamnet: bool = Query(True),
    use_openl3: bool = Query(True)
):
    """Upload and analyze multiple audio files"""
    results = []
    errors = []
    
    for file in files:
        try:
            metadata = await analyze_single_file(file, use_yamnet, use_openl3)
            results.append({
                "filename": file.filename,
                "status": "success",
                "metadata": metadata.model_dump()
            })
        except Exception as e:
            logging.error(f"Error analyzing {file.filename}: {e}")
            errors.append({
                "filename": file.filename,
                "status": "error",
                "error": str(e)
            })
    
    return {
        "total": len(files),
        "successful": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors
    }

@api_router.get("/tracks", response_model=List[TrackMetadata])
async def get_tracks():
    """Get all analyzed tracks"""
    tracks = await db.tracks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for track in tracks:
        if isinstance(track['analyzed_at'], str):
            track['analyzed_at'] = datetime.fromisoformat(track['analyzed_at'])
    
    return tracks

@api_router.get("/track/{track_id}", response_model=TrackMetadata)
async def get_track(track_id: str):
    """Get single track by ID"""
    track = await db.tracks.find_one({"id": track_id}, {"_id": 0})
    
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    if isinstance(track['analyzed_at'], str):
        track['analyzed_at'] = datetime.fromisoformat(track['analyzed_at'])
    
    return track

@api_router.delete("/track/{track_id}")
async def delete_track(track_id: str):
    """Delete a track"""
    result = await db.tracks.delete_one({"id": track_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Track not found")
    
    return {"message": "Track deleted successfully"}

@api_router.post("/search", response_model=List[TrackMetadata])
async def search_tracks(filters: SearchFilters):
    """Search tracks with filters"""
    query = {}
    
    # BPM filters
    if filters.min_bpm or filters.max_bpm:
        query['bpm'] = {}
        if filters.min_bpm:
            query['bpm']['$gte'] = filters.min_bpm
        if filters.max_bpm:
            query['bpm']['$lte'] = filters.max_bpm
    
    # Key filter
    if filters.key:
        query['key'] = filters.key
    
    # Instrument filter
    if filters.instruments:
        query['instruments.name'] = {'$in': filters.instruments}
    
    # Mood filter
    if filters.mood_tags:
        query['mood_tags'] = {'$in': filters.mood_tags}
    
    tracks = await db.tracks.find(query, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps
    for track in tracks:
        if isinstance(track['analyzed_at'], str):
            track['analyzed_at'] = datetime.fromisoformat(track['analyzed_at'])
    
    return tracks

@api_router.get("/stats")
async def get_stats():
    """Get database statistics"""
    total_tracks = await db.tracks.count_documents({})
    
    # Get all tracks for stats
    tracks = await db.tracks.find({}, {"_id": 0}).to_list(1000)
    
    if not tracks:
        return {
            "total_tracks": 0,
            "avg_bpm": 0,
            "common_keys": [],
            "common_moods": [],
            "total_duration": 0
        }
    
    # Calculate stats
    avg_bpm = np.mean([t['bpm'] for t in tracks])
    total_duration = sum([t['duration'] for t in tracks])
    
    # Common keys
    keys = [t['key'] for t in tracks]
    key_counts = {}
    for k in keys:
        key_counts[k] = key_counts.get(k, 0) + 1
    common_keys = sorted(key_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Common moods
    all_moods = []
    for t in tracks:
        all_moods.extend(t['mood_tags'])
    mood_counts = {}
    for m in all_moods:
        mood_counts[m] = mood_counts.get(m, 0) + 1
    common_moods = sorted(mood_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return {
        "total_tracks": total_tracks,
        "avg_bpm": round(avg_bpm, 2),
        "common_keys": [k[0] for k in common_keys],
        "common_moods": [m[0] for m in common_moods],
        "total_duration": round(total_duration, 2)
    }

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