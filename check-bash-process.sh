#!/bin/bash
# Script to investigate high CPU bash process on remote server
# Run this on the server where PID 1237515 is running

PID=1237515

echo "=== Process Information ==="
ps -fp $PID 2>/dev/null || echo "Process $PID not found"

echo ""
echo "=== Command Line ==="
cat /proc/$PID/cmdline 2>/dev/null | tr '\0' ' ' || echo "Cannot read cmdline"
echo ""

echo "=== Process Tree ==="
pstree -p $PID 2>/dev/null || ps --forest -o pid,ppid,cmd -g $(ps -o pgid= -p $PID 2>/dev/null | tr -d ' ') 2>/dev/null || echo "Cannot get process tree"

echo ""
echo "=== Open Files (first 20) ==="
lsof -p $PID 2>/dev/null | head -20 || echo "Cannot list open files"

echo ""
echo "=== Environment Variables ==="
cat /proc/$PID/environ 2>/dev/null | tr '\0' '\n' | head -20 || echo "Cannot read environment"

echo ""
echo "=== Working Directory ==="
ls -la /proc/$PID/cwd 2>/dev/null || echo "Cannot read working directory"

echo ""
echo "=== Script/Command Being Executed ==="
# Try to find what script it's running
ps -p $PID -o args= 2>/dev/null | head -1

echo ""
echo "=== Check for infinite loops or high CPU scripts ==="
# Look for common patterns
ps -p $PID -o etime= 2>/dev/null
echo "Process has been running for the time shown above"

