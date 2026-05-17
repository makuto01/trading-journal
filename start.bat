@echo off
cd /d "%~dp0"

echo Starting Trading Journal...

:: Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

:: Create .env if missing
if not exist ".env" (
    echo Creating .env from template...
    copy .env.example .env
    echo.
    echo IMPORTANT: Edit .env and add your GEMINI_API_KEY before using image analysis.
    echo.
    pause
)

:: Generate Prisma client
call npx prisma generate --silent 2>nul

:: Run migrations
call npx prisma migrate deploy 2>nul

:: Open browser after a short delay (server needs a moment to start)
start "" /b cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3000"

:: Start dev server (keeps window open)
call npm run dev
