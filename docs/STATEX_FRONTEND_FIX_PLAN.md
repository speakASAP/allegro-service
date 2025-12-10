# StateX Frontend Fix Plan - NODE_ENV and Malware Cleanup

## Problem Summary

1. **NODE_ENV Misconfiguration**: `.env` file has `NODE_ENV=development` but container runs `npm start` (production command)
2. **Security Compromise**: Container has been infected with malware scripts:
   - `/tmp/runnv/alive.sh`
   - `/tmp/runnv/lived.sh`
   - `/var/tmp/docker.64`
3. **Zombie Processes**: Malware scripts spawn processes that become zombies (13+ zombies)

## Root Cause Analysis

### Configuration Issue

- **Location**: `/home/statex/statex/.env`
- **Current Value**: `NODE_ENV=development`
- **Expected Value**: `NODE_ENV=production`
- **Impact**: Container runs in development mode with production command, causing misconfiguration

### Malware Scripts

- **NOT in codebase**: These scripts are NOT part of the legitimate codebase
- **Location in container**: `/tmp/runnv/alive.sh`, `/tmp/runnv/lived.sh`, `/var/tmp/docker.64`
- **Source**: Injected into running container (security breach)
- **Behavior**: Spawn processes that become zombies, potentially exfiltrate data

## Fix Plan

### Phase 1: Immediate Security Response

1. Kill malicious processes
2. Remove malicious files from container
3. Stop and restart container with fixed configuration

### Phase 2: Configuration Fix

1. Update `.env` file: Change `NODE_ENV=development` to `NODE_ENV=production`
2. Rebuild container to ensure clean state
3. Restart container

### Phase 3: Verification

1. Verify NODE_ENV is production
2. Verify no zombie processes
3. Verify no malicious scripts
4. Verify container health

## Implementation Steps

### Step 1: Kill Malicious Processes (Requires Sudo)

```bash
ssh statex
sudo kill -9 2631674 2631675 2759155
```

### Step 2: Remove Malicious Files from Container

```bash
docker exec statex-frontend-green rm -rf /tmp/runnv /var/tmp/docker.64
```

### Step 3: Stop Container

```bash
cd /home/statex/statex
docker compose -f docker-compose.green.yml stop frontend
```

### Step 4: Fix NODE_ENV in .env File

```bash
cd /home/statex/statex
# Backup current .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Update NODE_ENV to production
sed -i 's/^NODE_ENV=development$/NODE_ENV=production/' .env

# Verify change
grep NODE_ENV .env
```

### Step 5: Rebuild and Restart Container

```bash
cd /home/statex/statex
docker compose -f docker-compose.green.yml up -d --build frontend
```

### Step 6: Verify Fix

```bash
# Check NODE_ENV in container
docker exec statex-frontend-green sh -c 'echo $NODE_ENV'

# Check for zombie processes
ps aux | awk '$8 ~ /Z/ { count++ } END { print count " zombie processes" }'

# Check for malicious files
docker exec statex-frontend-green sh -c 'ls -la /tmp/runnv /var/tmp/docker.64 2>&1'

# Check container health
docker ps --filter name=statex-frontend-green
```

## Files to Modify

### 1. `/home/statex/statex/.env`

**Change:**

```bash
NODE_ENV=development
```

**To:**

```bash
NODE_ENV=production
```

## Security Recommendations

1. **Investigate Breach**: Determine how malware was injected
2. **Review Container Security**: Check for exposed ports, volumes, or misconfigurations
3. **Update Dependencies**: Ensure all packages are up to date
4. **Add Monitoring**: Implement process monitoring to detect anomalies
5. **Regular Audits**: Schedule regular security audits

## Notes

- The malware scripts (`alive.sh`, `lived.sh`, `docker.64`) are **NOT** in the codebase
- They were injected into the running container
- After fixing NODE_ENV and restarting, the container should be clean
- Zombie processes will be cleaned up when parent process (npm start) is restarted
