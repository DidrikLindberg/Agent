@echo off
cd /d "C:\Users\lindb\Repos\Agent"
node dist\index.js >> logs\agent.log 2>&1
