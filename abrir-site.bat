@echo off
cd /d "%~dp0"
start "" http://localhost:5180
python -m http.server 5180
