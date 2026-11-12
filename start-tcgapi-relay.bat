@echo off
title Vanguard Table - TCG API relay
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\tcgapi-proxy.ps1"
