@echo off
echo Starting ReqFlow...

:: Start Go server (MCP + REST API)
echo [1/2] Starting backend server...
start "ReqFlow Server" cmd /c "cd /d %~dp0server && reqflow-mcp.exe"

:: Wait a moment for server to start
timeout /t 2 /nobreak >nul

:: Start frontend dev server
echo [2/2] Starting frontend...
start "ReqFlow Frontend" cmd /c "cd /d %~dp0web && npm run dev"

echo.
echo ReqFlow is running:
echo   Frontend: http://localhost:5173
echo   API:      http://localhost:8081
echo   MCP:      stdio (via server process)
echo.
