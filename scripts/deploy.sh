#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'

SERVICE_NAME="allegro-service"
API_GATEWAY_NAME="allegro-api-gateway"
FRONTEND_NAME="allegro-frontend"
NAMESPACE="${NAMESPACE:-statex-apps}"
K8S_DIR="$PROJECT_ROOT/k8s"
REGISTRY="${REGISTRY:-localhost:5000}"
DEFAULT_TAG="$(cd "$PROJECT_ROOT" && git rev-parse --short HEAD 2>/dev/null || date -u +%Y%m%d%H%M%S)"
IMAGE_TAG="${1:-$DEFAULT_TAG}"
SERVICE_IMAGE="${REGISTRY}/${SERVICE_NAME}:${IMAGE_TAG}"
SERVICE_IMAGE_LATEST="${REGISTRY}/${SERVICE_NAME}:latest"
API_GATEWAY_IMAGE="${REGISTRY}/${API_GATEWAY_NAME}:${IMAGE_TAG}"
API_GATEWAY_IMAGE_LATEST="${REGISTRY}/${API_GATEWAY_NAME}:latest"
FRONTEND_IMAGE="${REGISTRY}/${FRONTEND_NAME}:${IMAGE_TAG}"
FRONTEND_IMAGE_LATEST="${REGISTRY}/${FRONTEND_NAME}:latest"
FRONTEND_API_URL="${FRONTEND_API_URL:-https://allegro.alfares.cz/api}"

# shellcheck disable=SC1091
source "$(dirname "$PROJECT_ROOT")/shared/scripts/load-deploy-phase-timing.sh" "$PROJECT_ROOT" 2>/dev/null \
  || source "$HOME/Documents/Github/shared/scripts/load-deploy-phase-timing.sh" "$PROJECT_ROOT" \
  || { echo "Error: deploy timing library not found" >&2; exit 1; }
deploy_timing_init "$SERVICE_NAME"

preflight_service_health() {
  echo -e "${YELLOW}Preflight: checking Kubernetes and current service health...${NC}"

  if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
    echo -e "${RED}Namespace not found: $NAMESPACE${NC}"
    exit 1
  fi

  if ! kubectl get nodes >/dev/null 2>&1; then
    echo -e "${RED}kubectl cannot reach cluster${NC}"
    exit 1
  fi

  for app in "$SERVICE_NAME" "$API_GATEWAY_NAME" "$FRONTEND_NAME"; do
    BAD_PODS=$(kubectl get pods -n "$NAMESPACE" -l app="$app" --no-headers 2>/dev/null | awk '$3 ~ /Error|CrashLoopBackOff|ImagePullBackOff|CreateContainerConfigError|CreateContainerError|ErrImagePull/ {print $1}')
    if [ -n "$BAD_PODS" ]; then
      echo -e "${RED}Deployment $app has unhealthy pods before deploy:${NC}"
      kubectl get pods -n "$NAMESPACE" -l app="$app" -o wide || true
      exit 1
    fi
  done

  echo -e "${GREEN}Preflight passed${NC}"
}

rollout_wait() {
  local deployment="$1"
  echo -e "${YELLOW}Waiting for ${deployment} rollout...${NC}"
  deploy_timing_k8s_rollout_wait kubectl "$deployment" "$NAMESPACE"
}

echo -e "${BLUE}==========================================================${NC}"
echo -e "${BLUE}  Allegro Service - Kubernetes Deployment${NC}"
echo -e "${BLUE}==========================================================${NC}"

if [ ! -d "$K8S_DIR" ]; then
  echo -e "${RED}Missing k8s directory: $K8S_DIR${NC}"
  exit 1
fi

deploy_timing_run_phase "Preflight" preflight_service_health

deploy_timing_phase_start "Build images"
docker build -t "$SERVICE_IMAGE" -t "$SERVICE_IMAGE_LATEST" "$PROJECT_ROOT"
docker build -f "$PROJECT_ROOT/services/api-gateway/Dockerfile" -t "$API_GATEWAY_IMAGE" -t "$API_GATEWAY_IMAGE_LATEST" "$PROJECT_ROOT"
docker build -f "$PROJECT_ROOT/services/frontend/Dockerfile" --build-arg FRONTEND_API_URL="$FRONTEND_API_URL" -t "$FRONTEND_IMAGE" -t "$FRONTEND_IMAGE_LATEST" "$PROJECT_ROOT"
deploy_timing_phase_end "Build images"

deploy_timing_phase_start "Push images"
docker push "$SERVICE_IMAGE"
docker push "$SERVICE_IMAGE_LATEST"
docker push "$API_GATEWAY_IMAGE"
docker push "$API_GATEWAY_IMAGE_LATEST"
docker push "$FRONTEND_IMAGE"
docker push "$FRONTEND_IMAGE_LATEST"
deploy_timing_phase_end "Push images"

deploy_timing_phase_start "Apply Kubernetes manifests"
echo -e "${YELLOW}Applying Kubernetes manifests...${NC}"
for manifest in configmap.yaml external-secret.yaml deployment.yaml service.yaml api-gateway-deployment.yaml api-gateway-service.yaml frontend-deployment.yaml frontend-service.yaml ingress.yaml; do
  if [ -f "$K8S_DIR/$manifest" ]; then
    kubectl apply -f "$K8S_DIR/$manifest" -n "$NAMESPACE"
  fi
done
echo -e "${GREEN}OK Kubernetes manifests applied${NC}"
deploy_timing_phase_end "Apply Kubernetes manifests"

deploy_timing_phase_start "Set deployment images"
kubectl set image "deployment/${SERVICE_NAME}" app="$SERVICE_IMAGE" -n "$NAMESPACE"
kubectl set image "deployment/${API_GATEWAY_NAME}" app="$API_GATEWAY_IMAGE" -n "$NAMESPACE"
kubectl set image "deployment/${FRONTEND_NAME}" app="$FRONTEND_IMAGE" -n "$NAMESPACE"
deploy_timing_phase_end "Set deployment images"

deploy_timing_phase_start "Wait for rollouts"
rollout_wait "$SERVICE_NAME"
rollout_wait "$API_GATEWAY_NAME"
rollout_wait "$FRONTEND_NAME"
deploy_timing_phase_end "Wait for rollouts"

deploy_timing_phase_start "Post-deploy status"
kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME"
kubectl get pods -n "$NAMESPACE" -l app="$API_GATEWAY_NAME"
kubectl get pods -n "$NAMESPACE" -l app="$FRONTEND_NAME"
deploy_timing_phase_end "Post-deploy status"

deploy_timing_finish_success "Allegro Service"
DEPLOY_TIMING_FINISHED=1
exit 0
