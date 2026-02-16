"""
WebSocket Router - Real-time job status updates
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json
import asyncio

from backend.db.database import get_db
from backend.db.models import ProcessingJob

router = APIRouter()


class ConnectionManager:
    """Manage WebSocket connections and broadcasts"""
    
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
    
    def disconnect(self, websocket: WebSocket, job_id: str = None):
        if job_id and job_id in self.active_connections:
            self.active_connections[job_id].discard(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]
    
    def subscribe(self, job_id: str, websocket: WebSocket):
        if job_id not in self.active_connections:
            self.active_connections[job_id] = set()
        self.active_connections[job_id].add(websocket)
    
    async def broadcast_to_job(self, job_id: str, message: dict):
        if job_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[job_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.add(connection)
            
            # Clean up disconnected clients
            for connection in disconnected:
                self.active_connections[job_id].discard(connection)


manager = ConnectionManager()


async def get_job_status(job_id: str) -> dict:
    """Fetch current job status from database"""
    db = next(get_db())
    try:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        if not job:
            return {
                "job_id": job_id,
                "status": "not_found",
                "error": "Job not found"
            }
        
        return {
            "job_id": job.id,
            "status": job.status,
            "progress": job.progress,
            "stage": job.current_stage,
            "error": job.error_message,
            "result": job.result
        }
    finally:
        db.close()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time job updates
    
    Client sends: {"action": "subscribe", "job_id": "xxx"}
    Server sends: {"job_id": "xxx", "status": "processing", "progress": 50, ...}
    """
    await manager.connect(websocket)
    subscribed_jobs = set()
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            action = message.get("action")
            job_id = message.get("job_id")
            
            if action == "subscribe" and job_id:
                # Subscribe to job updates
                manager.subscribe(job_id, websocket)
                subscribed_jobs.add(job_id)
                
                # Send initial status
                status = await get_job_status(job_id)
                await websocket.send_json(status)
                
                # Start polling for updates (in production, use Celery events)
                asyncio.create_task(poll_job_status(job_id, websocket))
            
            elif action == "unsubscribe" and job_id:
                manager.disconnect(websocket, job_id)
                subscribed_jobs.discard(job_id)
    
    except WebSocketDisconnect:
        # Clean up all subscriptions
        for job_id in subscribed_jobs:
            manager.disconnect(websocket, job_id)


async def poll_job_status(job_id: str, websocket: WebSocket):
    """
    Poll job status and send updates
    In production, replace with Celery event listeners
    """
    last_status = None
    max_checks = 300  # 5 minutes with 1s interval
    checks = 0
    
    while checks < max_checks:
        try:
            status = await get_job_status(job_id)
            
            # Send update if status changed
            if status != last_status:
                await manager.broadcast_to_job(job_id, status)
                last_status = status
            
            # Stop polling if job is completed or failed
            if status.get("status") in ["completed", "failed"]:
                break
            
            await asyncio.sleep(1)
            checks += 1
        
        except Exception as e:
            print(f"Error polling job {job_id}: {e}")
            break


# Export manager for use in workers
__all__ = ["router", "manager"]
