import sqlite3
from fastapi import FastAPI, HTTPException, Depends, status, Body, Path, Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import JWTError, jwt
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional, List
import random
from collections import Counter, defaultdict
import time
from fastapi.middleware.cors import CORSMiddleware

SECRET_KEY = "lucidtalk_secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

app = FastAPI()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SQLite setup
def get_db():
    conn = sqlite3.connect("users.db")
    conn.row_factory = sqlite3.Row
    return conn

def create_user_table():
    conn = get_db()
    conn.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        hashed_password TEXT NOT NULL
    )''')
    # Add questions table with tag (nullable) and is_favorite
    conn.execute('''CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        question_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        report_text TEXT NOT NULL,
        tag TEXT,
        is_favorite BOOLEAN DEFAULT FALSE
    )''')
    # Add answer_feedback table (add user_email for duplicate prevention)
    conn.execute('''CREATE TABLE IF NOT EXISTS answer_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER NOT NULL,
        user_email TEXT NOT NULL,
        feedback_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    # Migration: add user_email if not exists
    try:
        conn.execute('ALTER TABLE answer_feedback ADD COLUMN user_email TEXT')
    except Exception:
        pass
    conn.commit()
    conn.close()

create_user_table()

class User(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class QuestionRequest(BaseModel):
    question: str
    tag: Optional[str] = None

class QuestionResponse(BaseModel):
    report: str
    tag: Optional[str] = None

class HistoryItem(BaseModel):
    id: int
    question: str
    report: str
    tag: Optional[str] = None
    is_favorite: Optional[bool] = False

class UpdateQuestionRequest(BaseModel):
    question: str
    tag: Optional[str] = None

class FeedbackRequest(BaseModel):
    question_id: int
    feedback_type: str  # 'useful' or 'not_useful'

DUMMY_REPORTS = [
    "오늘은 행운의 날입니다!",
    "오늘은 중요한 결정을 내리지 마세요.",
    "긍정적인 마음가짐이 필요합니다.",
    "새로운 기회가 찾아올 수 있습니다.",
    "휴식이 필요한 하루입니다."
]

def get_user(email: str):
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    return user

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def authenticate_user(email: str, password: str):
    user = get_user(email)
    if not user:
        return False
    if not verify_password(password, user["hashed_password"]):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user(email)
    if user is None:
        raise credentials_exception
    return user

@app.post("/signup")
def signup(user: User):
    if get_user(user.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = get_password_hash(user.password)
    conn = get_db()
    conn.execute("INSERT INTO users (email, hashed_password) VALUES (?, ?)", (user.email, hashed_password))
    conn.commit()
    conn.close()
    return {"msg": "User created successfully"}

@app.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    access_token = create_access_token(
        data={"sub": user["email"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/protected")
def protected_route(current_user: dict = Depends(get_current_user)):
    return {"email": current_user["email"], "msg": "This is a protected route."}

def suggest_tag(question_text: str) -> str:
    # Simple keyword-based tag suggestion
    mapping = [
        (['이미지', '사진', '삽입', '크기', '편집'], '이미지 편집'),
        (['운세', '오늘', '내일', '이번주'], '운세'),
        (['AI', '챗봇', 'GPT', '인공지능'], 'AI'),
        (['로그인', '회원가입', '비밀번호'], '계정'),
        (['결제', '구독', '요금'], '결제'),
        (['오류', '에러', '문제'], '문제 해결'),
    ]
    q = question_text.lower()
    for keywords, tag in mapping:
        if any(k.lower() in q for k in keywords):
            return tag
    return '일반'

@app.post("/question", response_model=QuestionResponse)
def ask_question(
    req: QuestionRequest,
    current_user: dict = Depends(get_current_user)
):
    report = random.choice(DUMMY_REPORTS)
    # AI 기반 태그 자동 분류
    tag_to_save = req.tag
    if not tag_to_save or not tag_to_save.strip():
        tag_to_save = suggest_tag(req.question)
    conn = get_db()
    conn.execute(
        "INSERT INTO questions (user_email, question_text, report_text, tag) VALUES (?, ?, ?, ?)",
        (current_user["email"], req.question, report, tag_to_save)
    )
    conn.commit()
    conn.close()
    return {"report": report, "tag": tag_to_save}

@app.get("/history", response_model=List[HistoryItem])
def get_history(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT id, question_text, report_text, tag, is_favorite FROM questions WHERE user_email = ? ORDER BY is_favorite DESC, created_at DESC, id DESC",
        (current_user["email"],)
    ).fetchall()
    conn.close()
    return [
        {"id": row["id"], "question": row["question_text"], "report": row["report_text"], "tag": row["tag"], "is_favorite": bool(row["is_favorite"])}
        for row in rows
    ]

@app.delete("/history/{id}")
def delete_history_item(id: int = Path(...), current_user: dict = Depends(get_current_user)):
    conn = get_db()
    # Check ownership
    row = conn.execute(
        "SELECT user_email FROM questions WHERE id = ?",
        (id,)
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다.")
    if row["user_email"] != current_user["email"]:
        conn.close()
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
    conn.execute("DELETE FROM questions WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return {"msg": "삭제되었습니다."}

@app.put("/history/{id}")
def update_history_item(
    req: UpdateQuestionRequest,
    id: int = Path(...),
    current_user: dict = Depends(get_current_user)
):
    conn = get_db()
    # Check ownership
    row = conn.execute(
        "SELECT user_email FROM questions WHERE id = ?",
        (id,)
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다.")
    if row["user_email"] != current_user["email"]:
        conn.close()
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")
    report = random.choice(DUMMY_REPORTS)
    conn.execute(
        "UPDATE questions SET question_text = ?, report_text = ?, tag = ? WHERE id = ?",
        (req.question, report, req.tag, id)
    )
    conn.commit()
    conn.close()
    return {"question": req.question, "report": report, "tag": req.tag}

@app.get("/tags")
def get_tags():
    conn = get_db()
    rows = conn.execute("SELECT DISTINCT tag FROM questions WHERE tag IS NOT NULL AND tag != ''").fetchall()
    conn.close()
    return [row["tag"] for row in rows]

@app.get("/popular-tags")
def get_popular_tags(limit: int = 5):
    conn = get_db()
    rows = conn.execute("SELECT tag, COUNT(*) as cnt FROM questions WHERE tag IS NOT NULL AND tag != '' GROUP BY tag ORDER BY cnt DESC, tag ASC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [row["tag"] for row in rows]

@app.get("/questions")
def get_questions(
    tag: str = Query(None),
    current_user: dict = Depends(get_current_user)
):
    conn = get_db()
    # 1. 유저의 tag별 useful 피드백 집계
    tag_useful = defaultdict(int)
    tag_feedback_total = defaultdict(int)
    tag_feedback_recent = defaultdict(int)
    tag_feedback_last = defaultdict(str)
    tag_feedback_log = {}
    tag_rows = conn.execute(
        "SELECT q.tag, COUNT(f.id) as useful_count FROM questions q "
        "LEFT JOIN answer_feedback f ON q.id = f.question_id AND f.feedback_type = 'useful' AND f.user_email = ? "
        "WHERE q.user_email = ? AND q.tag IS NOT NULL AND q.tag != '' "
        "GROUP BY q.tag",
        (current_user["email"], current_user["email"])
    ).fetchall()
    for row in tag_rows:
        tag_useful[row["tag"]] = row["useful_count"]
    # 2. 각 질문별 AI 응답 피드백 수
    q_feedback = defaultdict(int)
    q_feedback_total = defaultdict(int)
    q_feedback_recent = defaultdict(int)
    q_feedback_last = defaultdict(str)
    q_rows = conn.execute(
        "SELECT question_id, SUM(CASE WHEN feedback_type='useful' THEN 1 ELSE 0 END) as useful_count, COUNT(*) as total_count, MAX(created_at) as last_feedback FROM answer_feedback WHERE user_email = ? GROUP BY question_id",
        (current_user["email"],)
    ).fetchall()
    for row in q_rows:
        q_feedback[row["question_id"]] = row["useful_count"]
        q_feedback_total[row["question_id"]] = row["total_count"]
        q_feedback_last[row["question_id"]] = row["last_feedback"]
    # 3. 질문 목록 조회
    base_query = "SELECT id, question_text, report_text, tag, is_favorite, created_at FROM questions WHERE user_email = ?"
    params = [current_user["email"]]
    tags = []
    if tag:
        tags = [t.strip() for t in tag.split(",") if t.strip()]
    base_query += " ORDER BY is_favorite DESC, created_at DESC, id DESC"
    qrows = conn.execute(base_query, params).fetchall()
    # 4. feedback_score 계산 및 정렬
    now = int(time.time())
    def recency_score(created_at):
        try:
            t = int(time.mktime(time.strptime(created_at, "%Y-%m-%d %H:%M:%S")))
            days = (now - t) / 86400
            return max(0, 10 - days)  # 10점 만점, 10일 이내만 가중치
        except:
            return 0
    result = []
    for row in qrows:
        tag_score = tag_useful.get(row["tag"], 0)
        q_score = q_feedback.get(row["id"], 0)
        recency = recency_score(row["created_at"]) if "created_at" in row.keys() else 0
        feedback_score = tag_score * 2 + q_score * 3 + recency
        log = f"tag_score={tag_score}*2 + q_score={q_score}*3 + recency={recency}"
        reason = None
        if row["tag"] and tag_score > 0:
            reason = f"태그 '{row['tag']}'이(가) 자주 유용하다고 평가됨"
        result.append({
            "id": row["id"],
            "question": row["question_text"],
            "report": row["report_text"],
            "tag": row["tag"],
            "is_favorite": bool(row["is_favorite"]),
            "created_at": row["created_at"],
            "추천근거": reason,
            "feedback_score": feedback_score,
            "정렬기준": log
        })
    # feedback_score 기준 정렬
    result.sort(key=lambda x: (-x["feedback_score"], -int(x["is_favorite"]), x["created_at"] if x["created_at"] else "", -x["id"]))
    conn.close()
    if tags:
        # AND 조건: 모든 태그가 포함된 질문만 반환
        result = [q for q in result if q["tag"] and all(t.lower() == q["tag"].lower() for t in tags)]
    return result

@app.get("/recent-tags")
def get_recent_tags(current_user: dict = Depends(get_current_user), limit: int = 5):
    conn = get_db()
    rows = conn.execute("SELECT tag FROM questions WHERE user_email = ? AND tag IS NOT NULL AND tag != '' ORDER BY created_at DESC, id DESC", (current_user["email"],)).fetchall()
    conn.close()
    seen = set()
    tags = []
    for row in rows:
        t = row["tag"]
        if t not in seen:
            tags.append(t)
            seen.add(t)
        if len(tags) >= limit:
            break
    return tags

@app.get("/related-questions")
def related_questions(tag: str, exclude_id: Optional[int] = None, current_user: dict = Depends(get_current_user), limit: int = 5):
    conn = get_db()
    base_query = "SELECT id, question_text, report_text, tag FROM questions WHERE user_email = ? AND tag = ?"
    params = [current_user["email"], tag]
    if exclude_id:
        base_query += " AND id != ?"
        params.append(exclude_id)
    base_query += " ORDER BY created_at DESC, id DESC LIMIT ?"
    params.append(limit)
    rows = conn.execute(base_query, params).fetchall()
    conn.close()
    return [
        {"id": row["id"], "question": row["question_text"], "report": row["report_text"], "tag": row["tag"]}
        for row in rows
    ]

@app.get("/suggest-question")
def suggest_question(tag: str, current_user: dict = Depends(get_current_user), limit: int = 3):
    conn = get_db()
    rows = conn.execute(
        "SELECT DISTINCT question_text FROM questions WHERE user_email = ? AND tag = ? ORDER BY created_at DESC, id DESC LIMIT ?",
        (current_user["email"], tag, limit)
    ).fetchall()
    conn.close()
    return {"suggested_questions": [row["question_text"] for row in rows]}

@app.patch("/questions/{id}/favorite")
def toggle_favorite(id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    row = conn.execute("SELECT user_email, is_favorite FROM questions WHERE id = ?", (id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="질문을 찾을 수 없습니다.")
    if row["user_email"] != current_user["email"]:
        conn.close()
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")
    new_fav = not bool(row["is_favorite"])
    conn.execute("UPDATE questions SET is_favorite = ? WHERE id = ?", (int(new_fav), id))
    conn.commit()
    conn.close()
    return {"id": id, "is_favorite": new_fav}

@app.post("/questions/{id}/suggest-answer")
def suggest_ai_answer(id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    # Check if already has an answer (report_text)
    row = conn.execute("SELECT report_text FROM questions WHERE id = ? AND user_email = ?", (id, current_user["email"])).fetchone()
    if not row:
        conn.close()
        return {"answer_text": None}
    if row["report_text"]:
        conn.close()
        return {"answer_text": row["report_text"]}
    # Dummy AI answer (replace with real AI call later)
    ai_answer = "AI가 자동으로 생성한 답변입니다. (예시)"
    conn.execute("UPDATE questions SET report_text = ? WHERE id = ?", (ai_answer, id))
    conn.commit()
    conn.close()
    return {"answer_text": ai_answer}

@app.post("/answer-feedback")
def answer_feedback(req: FeedbackRequest, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    # Check for existing feedback
    row = conn.execute(
        "SELECT id FROM answer_feedback WHERE question_id = ? AND user_email = ?",
        (req.question_id, current_user["email"])
    ).fetchone()
    if row:
        # Update existing feedback
        conn.execute(
            "UPDATE answer_feedback SET feedback_type = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?",
            (req.feedback_type, row["id"])
        )
        msg = "피드백이 갱신되었습니다."
    else:
        # Insert new feedback
        conn.execute(
            "INSERT INTO answer_feedback (question_id, user_email, feedback_type) VALUES (?, ?, ?)",
            (req.question_id, current_user["email"], req.feedback_type)
        )
        msg = "피드백이 저장되었습니다."
    conn.commit()
    conn.close()
    return {"msg": msg}

@app.get("/search-tags")
def search_tags(q: str):
    default_tags = ["기술", "디자인", "사업", "개인", "일상", "리더십", "협업", "커뮤니케이션"]
    if not q or len(q) < 1:
        return []
    conn = get_db()
    rows = conn.execute(
        "SELECT DISTINCT tag FROM questions WHERE tag IS NOT NULL AND tag != '' AND tag LIKE ?",
        (f"%{q}%",)
    ).fetchall()
    conn.close()
    filtered_tags = [row["tag"] for row in rows]
    # 기본 태그 우선 정렬
    default_matched = [t for t in default_tags if q in t and t in filtered_tags]
    other_matched = sorted([t for t in filtered_tags if t not in default_matched])
    result = default_matched + other_matched
    return result[:20]

@app.get("/questions-or")
def get_questions_or(
    tag: str = Query(None),
    current_user: dict = Depends(get_current_user)
):
    conn = get_db()
    base_query = "SELECT id, question_text, report_text, tag, is_favorite FROM questions WHERE user_email = ?"
    params = [current_user["email"]]
    tags = []
    if tag:
        tags = [t.strip() for t in tag.split(",") if t.strip()]
        if tags:
            placeholders = ",".join(["?"] * len(tags))
            base_query += f" AND tag IN ({placeholders})"
            params.extend(tags)
    base_query += " ORDER BY is_favorite DESC, created_at DESC, id DESC"
    rows = conn.execute(base_query, params).fetchall()
    conn.close()
    return [
        {"id": row["id"], "question": row["question_text"], "report": row["report_text"], "tag": row["tag"], "is_favorite": bool(row["is_favorite"])}
        for row in rows
    ]

@app.get("/questions-exclude")
def get_questions_exclude(
    tag: str = Query(None),
    current_user: dict = Depends(get_current_user)
):
    conn = get_db()
    base_query = "SELECT id, question_text, report_text, tag, is_favorite FROM questions WHERE user_email = ?"
    params = [current_user["email"]]
    tags = []
    if tag:
        tags = [t.strip() for t in tag.split(",") if t.strip()]
        if tags:
            placeholders = ",".join(["?"] * len(tags))
            base_query += f" AND tag NOT IN ({placeholders})"
            params.extend(tags)
    base_query += " ORDER BY is_favorite DESC, created_at DESC, id DESC"
    rows = conn.execute(base_query, params).fetchall()
    conn.close()
    return [
        {"id": row["id"], "question": row["question_text"], "report": row["report_text"], "tag": row["tag"], "is_favorite": bool(row["is_favorite"])}
        for row in rows
    ]

@app.get("/related-tags")
def related_tags(tag: str = Query(...), current_user: dict = Depends(get_current_user), limit: int = 5):
    conn = get_db()
    # Parse input tags
    tags = [t.strip() for t in tag.split(",") if t.strip()]
    # Get all tags from user's questions, excluding the input tags
    rows = conn.execute(
        "SELECT tag FROM questions WHERE user_email = ? AND tag IS NOT NULL AND tag != ''",
        (current_user["email"],)
    ).fetchall()
    conn.close()
    all_tags = [row["tag"] for row in rows if row["tag"] and row["tag"].lower() not in [t.lower() for t in tags]]
    counter = Counter(all_tags)
    related = [t for t, _ in counter.most_common(limit)]
    return {"related_tags": related} 