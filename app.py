import os
import shutil
import logging
import time
from pathlib import Path
from typing import Optional, List
from dotenv import load_dotenv
from fastapi import FastAPI, Form, Request, UploadFile, HTTPException, File, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import pytesseract
from pdf2image import convert_from_path
from PIL import Image
from sqlalchemy import create_engine, Column, Integer, String, Text, func
from sqlalchemy.orm import declarative_base, sessionmaker
import requests
from pydantic import BaseModel

# 初始化
load_dotenv()
app = FastAPI()

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 数据库配置
Base = declarative_base()
engine = create_engine('sqlite:///textbook.db')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 数据模型
class TextbookPage(Base):
    __tablename__ = 'textbook_pages'
    id = Column(Integer, primary_key=True)
    book_id = Column(String(50), index=True)
    page_number = Column(Integer)
    text_content = Column(Text)
    image_path = Column(String(255))

class ExamQuestion(Base):
    __tablename__ = 'exam_questions'
    id = Column(Integer, primary_key=True)
    keyword = Column(String(100), index=True)
    question = Column(Text)
    answer = Column(Text)
    difficulty = Column(String(20))
    year = Column(Integer)
    source = Column(String(100))

Base.metadata.create_all(bind=engine)

# 请求模型
class SearchRequest(BaseModel):
    query: str
    book_id: str

class AISearchRequest(BaseModel):
    question: str
    context: str = ""

# 文件目录配置
Path("static/pages").mkdir(parents=True, exist_ok=True)
Path("uploads").mkdir(parents=True, exist_ok=True)
Path("static/thumbs").mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# OCR配置
def detect_ocr_paths():
    tesseract_path = os.getenv('TESSERACT_CMD')
    poppler_path = os.getenv('POPPLER_PATH')
    
    tesseract_candidates = [
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Users\{}\AppData\Local\Tesseract-OCR\tesseract.exe'.format(os.getenv('USERNAME'))
    ]
    
    poppler_candidates = [
        r'C:\Program Files\poppler-24.08.0\Library\bin',
        r'C:\Users\{}\Downloads\poppler-24.08.0\Library\bin'.format(os.getenv('USERNAME'))
    ]
    
    if not tesseract_path:
        for path in tesseract_candidates:
            if Path(path).exists():
                tesseract_path = path
                break
    
    if not poppler_path:
        for path in poppler_candidates:
            if Path(path).exists():
                poppler_path = path
                break
    
    return tesseract_path, poppler_path

tesseract_cmd, poppler_bin = detect_ocr_paths()
if tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

# PDF处理
def process_pdf(pdf_path: str, book_id: str):
    try:
        start = time.time()
        images = convert_from_path(
            pdf_path,
            poppler_path=poppler_bin,
            thread_count=4,
            fmt='jpeg'
        )
        
        db = SessionLocal()
        try:
            for idx, img in enumerate(images):
                page_num = idx + 1
                img_path = f"static/pages/{book_id}_page{page_num}.jpg"
                img.save(img_path, 'JPEG', quality=85)
                
                text = pytesseract.image_to_string(
                    Image.open(img_path),
                    lang='chi_sim+eng',
                    config='--psm 6 --oem 3'
                )
                
                db.add(TextbookPage(
                    book_id=book_id,
                    page_number=page_num,
                    text_content=text,
                    image_path=img_path
                ))
                db.commit()
            
            return True
        except Exception as e:
            db.rollback()
            raise
        finally:
            db.close()
    except Exception as e:
        raise

# API路由
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    book_id: str = Form("default")
):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(400, detail="仅支持PDF文件")
    
    max_size = 50 * 1024 * 1024
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > max_size:
        raise HTTPException(413, detail="文件超过50MB限制")

    db = SessionLocal()
    exists = db.query(TextbookPage).filter_by(book_id=book_id).first()
    db.close()
    
    if exists:
        return JSONResponse(
            status_code=409,
            content={"status": "conflict", "message": f"课本ID {book_id} 已存在"}
        )

    timestamp = int(time.time())
    file_path = f"uploads/{book_id}_{timestamp}.pdf"
    try:
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        raise HTTPException(500, detail="文件保存失败")

    try:
        images = convert_from_path(file_path, first_page=1, last_page=1)
        thumb_path = f"static/thumbs/{book_id}_thumb.jpg"
        images[0].save(thumb_path, 'JPEG', quality=60)
        thumbnails = [thumb_path]
    except Exception as e:
        thumbnails = []

    background_tasks.add_task(process_pdf, file_path, book_id)
    return JSONResponse({
        "status": "processing",
        "message": "文件已接收，正在处理中...",
        "file_path": file_path,
        "thumbnails": thumbnails,
        "book_id": book_id,
        "filename": file.filename
    })

@app.post("/api/search")
async def search_pages(request: SearchRequest):
    db = SessionLocal()
    try:
        results = db.query(TextbookPage).filter(
            TextbookPage.book_id == request.book_id,
            TextbookPage.text_content.contains(request.query)
        ).all()
        
        return {
            "results": [{
                "page_number": r.page_number,
                "preview_text": r.text_content[:200] + "...",
                "image_path": r.image_path
            } for r in results]
        }
    finally:
        db.close()

@app.post("/api/ai/search")
async def ai_search(request: AISearchRequest):
    headers = {
        "Authorization": f"Bearer {os.getenv('DEEPSEEK_API_KEY')}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": "你是一个生物学助手"},
            {"role": "user", "content": f"上下文：{request.context}\n\n问题：{request.question}"}
        ],
        "temperature": 0.7
    }
    
    response = requests.post(
        "https://api.deepseek.com/v1/chat/completions",
        headers=headers,
        json=payload
    )
    
    return response.json()

@app.get("/api/page/{book_id}/{page_number}")
async def get_page(book_id: str, page_number: int):
    db = SessionLocal()
    try:
        page = db.query(TextbookPage).filter_by(
            book_id=book_id,
            page_number=page_number
        ).first()
        
        if not page:
            raise HTTPException(404, detail="Page not found")
            
        return {
            "page_number": page.page_number,
            "text_content": page.text_content,
            "image_path": page.image_path,
            "next_page": page_number + 1,
            "prev_page": max(1, page_number - 1)
        }
    finally:
        db.close()

@app.get("/api/exam/search")
async def search_exam_questions(keyword: str):
    db = SessionLocal()
    try:
        questions = db.query(ExamQuestion).filter(
            ExamQuestion.question.contains(keyword) |
            ExamQuestion.keyword.contains(keyword)
        ).all()
        
        return {
            "results": [{
                "id": q.id,
                "question": q.question,
                "answer": q.answer
            } for q in questions]
        }
    finally:
        db.close()

@app.get("/api/status")
async def check_status(file_path: str):
    book_id = Path(file_path).stem.split('_')[0]
    db = SessionLocal()
    exists = db.query(TextbookPage).filter_by(book_id=book_id).first()
    db.close()
    return {"status": "complete" if exists else "processing"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
