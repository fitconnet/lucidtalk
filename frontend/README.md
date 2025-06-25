# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# LucidTalk Frontend

## 개발 환경 준비 및 실행 방법

1. **frontend 폴더로 이동**
   ```bash
   cd frontend
   ```
2. **의존성 설치**
   ```bash
   npm install
   ```
3. **개발 서버 실행**
   ```bash
   npm run dev
   ```

> ⚠️ 루트(최상위) 폴더에서 `npm run dev`를 실행하면 동작하지 않습니다. 반드시 `frontend` 폴더로 이동 후 실행하세요.

---

## 백엔드(FastAPI) 실행 방법

1. **backend 폴더로 이동**
   ```bash
   cd ../backend
   ```
2. **FastAPI 서버 실행**
   ```bash
   uvicorn main:app --reload
   ```

---

## 디렉토리 구조

```
LucidTalk_MVP/
├── backend/
│   ├── main.py
│   └── users.db
├── frontend/
│   ├── src/
│   ├── package.json
│   └── ...
└── README.md (또는 각 폴더별 README.md)
```
