@echo off
setlocal

REM Force UTF-8 to avoid UnicodeEncodeError in Windows cp1252 terminals
chcp 65001 >nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

"C:\Users\Ben\AppData\Roaming\Python\Python311\Scripts\ccc.exe" %*

