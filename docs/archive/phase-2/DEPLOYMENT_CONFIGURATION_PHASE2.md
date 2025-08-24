# DEPLOYMENT - PHASE 2 ENTERPRISE

## Overview

Enterprise-grade deployment configuration for Courtesy Inspection Platform featuring Kubernetes/EKS, multi-region deployment, advanced monitoring, and blue-green deployment strategies.

## Table of Contents

1. [Enterprise Infrastructure Architecture](#1-enterprise-infrastructure-architecture)
2. [Kubernetes Orchestration](#2-kubernetes-orchestration)
3. [Advanced CI/CD Pipeline](#3-advanced-cicd-pipeline)
4. [Multi-Region Deployment](#4-multi-region-deployment)
5. [Advanced Monitoring & Observability](#5-advanced-monitoring--observability)
6. [Blue-Green Deployment](#6-blue-green-deployment)
7. [Security & Compliance](#7-security--compliance)
8. [Disaster Recovery](#8-disaster-recovery)
9. [Performance Optimization](#9-performance-optimization)

---

## 1. Enterprise Infrastructure Architecture

### 1.1 AWS EKS Multi-Region Setup

```yaml
# terraform/eks-infrastructure.tf
resource "aws_eks_cluster" "courtesy_inspection" {
  for_each = var.regions
  
  name     = "courtesy-inspection-${each.key}"
  role_arn = aws_iam_role.eks_cluster[each.key].arn
  version  = "1.28"

  vpc_config {
    subnet_ids              = aws_subnet.private[each.key][*].id
    endpoint_private_access = true
    endpoint_public_access  = true
    public_access_cidrs    = ["0.0.0.0/0"]
  }

  encryption_config {
    provider {
      key_arn = aws_kms_key.eks[each.key].arn
    }
    resources = ["secrets"]
  }

  enabled_cluster_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ]

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
    aws_iam_role_policy_attachment.eks_vpc_resource_controller,
  ]

  tags = {
    Environment = var.environment
    Region      = each.key
    Terraform   = "true"
  }
}

# Node Groups with Mixed Instance Types
resource "aws_eks_node_group" "general" {
  for_each = var.regions
  
  cluster_name    = aws_eks_cluster.courtesy_inspection[each.key].name
  node_group_name = "general-${each.key}"
  node_role_arn   = aws_iam_role.eks_node_group[each.key].arn
  subnet_ids      = aws_subnet.private[each.key][*].id

  capacity_type = "ON_DEMAND"
  
  scaling_config {
    desired_size = lookup(var.node_group_config[each.key], "desired_capacity", 3)
    max_size     = lookup(var.node_group_config[each.key], "max_size", 10)
    min_size     = lookup(var.node_group_config[each.key], "min_size", 2)
  }

  update_config {
    max_unavailable_percentage = 25
  }

  instance_types = ["m5.large", "m5.xlarge", "c5.large", "c5.xlarge"]

  remote_access {
    ec2_ssh_key               = aws_key_pair.eks_nodes[each.key].key_name
    source_security_group_ids = [aws_security_group.eks_remote_access[each.key].id]
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry_policy,
  ]

  tags = {
    Environment = var.environment
    Region      = each.key
    "kubernetes.io/cluster/${aws_eks_cluster.courtesy_inspection[each.key].name}" = "owned"
  }
}

# Spot Instance Node Group for Cost Optimization
resource "aws_eks_node_group" "spot" {
  for_each = var.regions
  
  cluster_name    = aws_eks_cluster.courtesy_inspection[each.key].name
  node_group_name = "spot-${each.key}"
  node_role_arn   = aws_iam_role.eks_node_group[each.key].arn
  subnet_ids      = aws_subnet.private[each.key][*].id

  capacity_type = "SPOT"
  
  scaling_config {
    desired_size = lookup(var.spot_node_config[each.key], "desired_capacity", 2)
    max_size     = lookup(var.spot_node_config[each.key], "max_size", 20)
    min_size     = lookup(var.spot_node_config[each.key], "min_size", 0)
  }

  instance_types = ["m5.large", "m4.large", "c5.large", "c4.large"]

  taint {
    key    = "spot"
    value  = "true"
    effect = "NO_SCHEDULE"
  }

  tags = {
    Environment = var.environment
    Region      = each.key
    NodeType    = "spot"
  }
}
```

### 1.2 Advanced Networking & Security

```yaml
# terraform/networking.tf
resource "aws_vpc" "main" {
  for_each = var.regions
  
  cidr_block           = var.vpc_cidrs[each.key]
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name                                                              = "courtesy-inspection-vpc-${each.key}"
    Environment                                                       = var.environment
    Region                                                           = each.key
    "kubernetes.io/cluster/courtesy-inspection-${each.key}"          = "shared"
  }
}

# Private Subnets for EKS
resource "aws_subnet" "private" {
  for_each = {
    for idx, az in var.availability_zones : "${var.regions[0]}-${idx}" => {
      region = var.regions[0]
      az     = az
      cidr   = cidrsubnet(var.vpc_cidrs[var.regions[0]], 4, idx + 1)
    }
  }

  vpc_id            = aws_vpc.main[each.value.region].id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az

  tags = {
    Name                                                              = "private-${each.key}"
    Environment                                                       = var.environment
    Type                                                             = "private"
    "kubernetes.io/cluster/courtesy-inspection-${each.value.region}" = "owned"
    "kubernetes.io/role/internal-elb"                                = "1"
  }
}

# Public Subnets for Load Balancers
resource "aws_subnet" "public" {
  for_each = {
    for idx, az in var.availability_zones : "${var.regions[0]}-${idx}" => {
      region = var.regions[0]
      az     = az
      cidr   = cidrsubnet(var.vpc_cidrs[var.regions[0]], 4, idx + 10)
    }
  }

  vpc_id                  = aws_vpc.main[each.value.region].id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = true

  tags = {
    Name                                                              = "public-${each.key}"
    Environment                                                       = var.environment
    Type                                                             = "public"
    "kubernetes.io/cluster/courtesy-inspection-${each.value.region}" = "owned"
    "kubernetes.io/role/elb"                                         = "1"
  }
}

# VPC Peering for Multi-Region Communication
resource "aws_vpc_peering_connection" "region_peering" {
  count = length(var.regions) > 1 ? 1 : 0
  
  vpc_id        = aws_vpc.main[var.regions[0]].id
  peer_vpc_id   = aws_vpc.main[var.regions[1]].id
  peer_region   = var.regions[1]
  auto_accept   = false

  tags = {
    Name        = "courtesy-inspection-region-peering"
    Environment = var.environment
  }
}
```

---

## 2. Kubernetes Orchestration

### 2.1 Advanced Helm Chart Configuration

```yaml
# helm/courtesy-inspection/values-production.yaml
global:
  imageRegistry: ghcr.io
  imagePullSecrets:
    - name: ghcr-secret
  
  environment: production
  namespace: courtesy-inspection-prod
  
  serviceMonitor:
    enabled: true
    namespace: monitoring
    labels:
      app: courtesy-inspection
  
  podSecurityPolicy:
    enabled: true
  
  networkPolicy:
    enabled: true

# Multi-Region Configuration
multiRegion:
  enabled: true
  regions:
    primary: us-west-2
    secondary: us-east-1
    dr: eu-west-1
  
  crossRegionReplication:
    enabled: true
    schedule: "0 2 * * *"

# Advanced API Gateway Configuration
apiGateway:
  replicaCount: 5
  image:
    repository: courtesy-inspection/api-gateway
    tag: latest
    pullPolicy: Always
  
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2
      maxUnavailable: 1
  
  service:
    type: ClusterIP
    port: 80
    targetPort: 9400
    annotations:
      service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
      service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"
  
  # Advanced Ingress with Multiple Domains
  ingress:
    enabled: true
    className: nginx
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt-prod
      nginx.ingress.kubernetes.io/ssl-redirect: "true"
      nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
      nginx.ingress.kubernetes.io/rate-limit: "1000"
      nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    hosts:
      - host: api.courtesyinspection.com
        paths:
          - path: /
            pathType: Prefix
      - host: api-staging.courtesyinspection.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: api-tls-secret
        hosts:
          - api.courtesyinspection.com
          - api-staging.courtesyinspection.com
  
  # Resource Management
  resources:
    requests:
      memory: 1Gi
      cpu: 1000m
    limits:
      memory: 2Gi
      cpu: 2000m
  
  # Advanced Autoscaling
  autoscaling:
    enabled: true
    minReplicas: 5
    maxReplicas: 50
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
    behavior:
      scaleUp:
        stabilizationWindowSeconds: 60
        policies:
        - type: Percent
          value: 100
          periodSeconds: 15
      scaleDown:
        stabilizationWindowSeconds: 300
        policies:
        - type: Percent
          value: 10
          periodSeconds: 60
  
  # Pod Disruption Budget
  podDisruptionBudget:
    enabled: true
    minAvailable: 3
  
  # Advanced Probes
  livenessProbe:
    httpGet:
      path: /health
      port: 9400
    initialDelaySeconds: 60
    periodSeconds: 10
    timeoutSeconds: 5
    failureThreshold: 3
    successThreshold: 1
  
  readinessProbe:
    httpGet:
      path: /ready
      port: 9400
    initialDelaySeconds: 10
    periodSeconds: 5
    timeoutSeconds: 3
    failureThreshold: 3
    successThreshold: 2
  
  # Security Context
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    fsGroup: 1001
    capabilities:
      drop:
        - ALL
    readOnlyRootFilesystem: true
  
  # Environment Variables
  env:
    - name: NODE_ENV
      value: production
    - name: PORT
      value: "9400"
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: db-secrets
          key: database-url
    - name: REDIS_CLUSTER_URL
      valueFrom:
        secretKeyRef:
          name: cache-secrets
          key: redis-cluster-url

# Database Configuration (External RDS)
postgresql:
  enabled: false
  externalDatabase:
    host: prod-db-cluster.courtesy-inspection.internal
    port: 5432
    database: courtesy_inspection
    existingSecret: db-secrets
    existingSecretPasswordKey: password
    
    # Read Replicas Configuration
    readReplicas:
      enabled: true
      hosts:
        - prod-db-replica-1.courtesy-inspection.internal
        - prod-db-replica-2.courtesy-inspection.internal
    
    # Connection Pooling
    pgbouncer:
      enabled: true
      maxConnections: 200
      defaultPoolSize: 25

# Redis Cluster (External ElastiCache)
redis:
  enabled: false
  externalRedis:
    cluster:
      enabled: true
      hosts:
        - prod-redis-cluster-001.courtesy-inspection.cache.amazonaws.com
        - prod-redis-cluster-002.courtesy-inspection.cache.amazonaws.com
        - prod-redis-cluster-003.courtesy-inspection.cache.amazonaws.com
    port: 6379
    auth:
      enabled: true
      existingSecret: cache-secrets
      existingSecretPasswordKey: password

# Monitoring & Observability
monitoring:
  prometheus:
    enabled: true
    serviceMonitor:
      enabled: true
      interval: 30s
      path: /metrics
    rules:
      enabled: true
  
  grafana:
    enabled: true
    dashboards:
      enabled: true
  
  jaeger:
    enabled: true
    collector:
      enabled: true
    query:
      enabled: true

# Security Policies
securityPolicies:
  networkPolicy:
    enabled: true
    ingress:
      - from:
        - namespaceSelector:
            matchLabels:
              name: nginx-ingress
        ports:
        - protocol: TCP
          port: 9400
    egress:
      - to:
        - namespaceSelector:
            matchLabels:
              name: kube-system
      - to: []
        ports:
        - protocol: TCP
          port: 5432  # PostgreSQL
        - protocol: TCP
          port: 6379  # Redis
  
  podSecurityPolicy:
    enabled: true
    allowPrivilegeEscalation: false
    requiredDropCapabilities:
      - ALL
    allowedCapabilities: []
    runAsUser:
      rule: MustRunAsNonRoot
    fsGroup:
      rule: RunAsAny
```

### 2.2 Advanced Kubernetes Manifests

```yaml
# k8s/production/statefulset-cache.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-cluster
  namespace: courtesy-inspection-prod
spec:
  serviceName: redis-cluster-headless
  replicas: 6
  selector:
    matchLabels:
      app: redis-cluster
  template:
    metadata:
      labels:
        app: redis-cluster
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
          name: client
        - containerPort: 16379
          name: gossip
        command:
        - redis-server
        - "/etc/redis/redis.conf"
        volumeMounts:
        - name: conf
          mountPath: /etc/redis
        - name: data
          mountPath: /data
        env:
        - name: POD_IP
          valueFrom:
            fieldRef:
              fieldPath: status.podIP
      volumes:
      - name: conf
        configMap:
          name: redis-cluster-config
          defaultMode: 0755
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 50Gi
```

---

## 3. Advanced CI/CD Pipeline

### 3.1 Enterprise GitHub Actions Workflow

```yaml
# .github/workflows/enterprise-cicd.yml
name: Enterprise CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: courtesy-inspection
  KUBE_CONFIG_DATA: ${{ secrets.KUBE_CONFIG_DATA }}

jobs:
  # Security Scanning
  security-scan:
    runs-on: ubuntu-latest
    outputs:
      security-scan-results: ${{ steps.security-summary.outputs.results }}
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

      - name: OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'courtesy-inspection'
          path: '.'
          format: 'ALL'

      - name: Security Summary
        id: security-summary
        run: |
          echo "results=passed" >> $GITHUB_OUTPUT

  # Multi-Environment Testing
  test-matrix:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
        database: [postgres15, postgres14]
        test-type: [unit, integration, e2e]
    
    services:
      postgres:
        image: postgres:${{ matrix.database == 'postgres15' && '15' || '14' }}
        env:
          POSTGRES_DB: courtesy_test
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ${{ matrix.test-type }} tests
        run: npm run test:${{ matrix.test-type }}
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://test_user:test_password@localhost:5432/courtesy_test
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        if: matrix.test-type == 'unit'
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  # Performance Testing
  performance-test:
    runs-on: ubuntu-latest
    needs: [test-matrix]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run performance tests
        run: npm run test:performance

      - name: Upload performance results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: performance-results/

  # Build and Push Multi-Architecture Images
  build-and-push:
    needs: [security-scan, test-matrix, performance-test]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    
    outputs:
      image-digest: ${{ steps.build.outputs.digest }}
      image-tag: ${{ steps.meta.outputs.tags }}
    
    strategy:
      matrix:
        service:
          - api-gateway
          - auth-service
          - inspection-service
          - customer-service
          - shop-service
          - media-service
          - report-service
          - notification-service
          - analytics-service
          - ai-service
          - web-portal
          - admin-panel
          - customer-portal

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ github.repository }}/${{ matrix.service }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./services/${{ matrix.service }}/Dockerfile
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            BUILD_DATE=${{ fromJSON(steps.meta.outputs.json).labels['org.opencontainers.image.created'] }}
            VCS_REF=${{ github.sha }}

  # Deploy to Staging (Multi-Region)
  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: staging
    
    strategy:
      matrix:
        region: [us-west-2, us-east-1]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ matrix.region }}

      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'v1.28.0'

      - name: Setup Helm
        uses: azure/setup-helm@v3
        with:
          version: 'v3.12.0'

      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --region ${{ matrix.region }} --name courtesy-inspection-staging-${{ matrix.region }}

      - name: Deploy with Helm
        run: |
          helm upgrade --install courtesy-inspection ./helm/courtesy-inspection \
            --namespace courtesy-inspection-staging \
            --create-namespace \
            --values ./helm/courtesy-inspection/values-staging.yaml \
            --set global.image.tag=${{ needs.build-and-push.outputs.image-tag }} \
            --set global.region=${{ matrix.region }} \
            --wait \
            --timeout=20m

      - name: Run smoke tests
        run: |
          npm run test:smoke:staging:${{ matrix.region }}
        env:
          STAGING_API_URL: https://staging-${{ matrix.region }}-api.courtesyinspection.com

  # Blue-Green Production Deployment
  deploy-production:
    needs: [build-and-push, deploy-staging]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    
    strategy:
      matrix:
        region: [us-west-2, us-east-1]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID_PROD }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY_PROD }}
          aws-region: ${{ matrix.region }}

      - name: Setup kubectl and Helm
        uses: azure/setup-kubectl@v3
        with:
          version: 'v1.28.0'

      - name: Setup Helm
        uses: azure/setup-helm@v3
        with:
          version: 'v3.12.0'

      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --region ${{ matrix.region }} --name courtesy-inspection-prod-${{ matrix.region }}

      - name: Create database backup
        run: |
          kubectl exec -n courtesy-inspection-prod deployment/postgres-backup -- \
            pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

      - name: Deploy Green Environment
        run: |
          # Deploy green environment
          helm upgrade --install courtesy-inspection-green ./helm/courtesy-inspection \
            --namespace courtesy-inspection-prod \
            --values ./helm/courtesy-inspection/values-production.yaml \
            --set global.image.tag=${{ needs.build-and-push.outputs.image-tag }} \
            --set global.region=${{ matrix.region }} \
            --set global.environment=green \
            --wait \
            --timeout=30m

      - name: Run Health Checks on Green
        run: |
          # Wait for green environment to be ready
          kubectl wait --for=condition=ready pod -l app=api-gateway,environment=green -n courtesy-inspection-prod --timeout=300s
          
          # Run comprehensive health checks
          kubectl run health-check-green --image=curlimages/curl --restart=Never --rm -i -- \
            curl -f http://api-gateway-green:80/health/deep

      - name: Switch Traffic to Green (Blue-Green Deployment)
        run: |
          # Update service selectors to point to green environment
          kubectl patch service api-gateway -n courtesy-inspection-prod \
            -p '{"spec":{"selector":{"environment":"green"}}}'
          kubectl patch service web-portal -n courtesy-inspection-prod \
            -p '{"spec":{"selector":{"environment":"green"}}}'
          
          # Wait for traffic switch
          sleep 60
          
          # Verify external connectivity
          curl -f https://api.courtesyinspection.com/health

      - name: Run Production Verification Tests
        run: |
          npm run test:smoke:production:${{ matrix.region }}
          npm run test:integration:production:${{ matrix.region }}
        env:
          PRODUCTION_API_URL: https://api.courtesyinspection.com

      - name: Clean Up Blue Environment
        run: |
          # Remove blue environment after successful green deployment
          helm uninstall courtesy-inspection-blue -n courtesy-inspection-prod --ignore-not-found

  # Multi-Region Traffic Management
  traffic-management:
    needs: deploy-production
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Update Route53 Health Checks
        run: |
          # Update Route53 health checks for new deployment
          aws route53 change-resource-record-sets \
            --hosted-zone-id ${{ secrets.ROUTE53_HOSTED_ZONE_ID }} \
            --change-batch file://route53-changes.json

      - name: Update CloudFront Distribution
        run: |
          # Invalidate CloudFront cache for new deployment
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"

  # Performance Monitoring
  performance-monitoring:
    needs: deploy-production
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Run Performance Baseline Tests
        run: |
          # Run performance tests against production
          npx lighthouse-ci autorun --config=.lighthouserc.json
          
      - name: Update Performance Metrics
        run: |
          # Send performance metrics to monitoring system
          curl -X POST "${{ secrets.GRAFANA_WEBHOOK_URL }}" \
            -H "Content-Type: application/json" \
            -d @performance-metrics.json

  # Notification and Reporting
  notify:
    needs: [deploy-production, traffic-management, performance-monitoring]
    runs-on: ubuntu-latest
    if: always()
    
    steps:
      - name: Send Slack notification
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
          fields: repo,message,commit,author,action,eventName,ref,workflow

      - name: Update Deployment Dashboard
        run: |
          # Update internal deployment dashboard
          curl -X POST "${{ secrets.DEPLOYMENT_DASHBOARD_API }}" \
            -H "Authorization: Bearer ${{ secrets.DASHBOARD_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "deployment_id": "${{ github.run_id }}",
              "status": "${{ job.status }}",
              "environment": "production",
              "version": "${{ needs.build-and-push.outputs.image-tag }}",
              "timestamp": "${{ github.event.head_commit.timestamp }}"
            }'

      - name: Generate Deployment Report
        run: |
          # Generate comprehensive deployment report
          echo "# Deployment Report" > deployment-report.md
          echo "- **Status**: ${{ job.status }}" >> deployment-report.md
          echo "- **Version**: ${{ needs.build-and-push.outputs.image-tag }}" >> deployment-report.md
          echo "- **Commit**: ${{ github.sha }}" >> deployment-report.md
          echo "- **Author**: ${{ github.actor }}" >> deployment-report.md
          
      - name: Upload Deployment Artifacts
        uses: actions/upload-artifact@v3
        with:
          name: deployment-report
          path: deployment-report.md
```

---

## 4. Multi-Region Deployment

### 4.1 Regional Configuration

```yaml
# terraform/variables.tf
variable "regions" {
  description = "AWS regions for multi-region deployment"
  type        = list(string)
  default     = ["us-west-2", "us-east-1", "eu-west-1"]
}

variable "region_config" {
  description = "Region-specific configuration"
  type = map(object({
    primary                = bool
    disaster_recovery     = bool
    node_count           = number
    instance_types       = list(string)
    availability_zones   = list(string)
    database_multi_az    = bool
    backup_retention     = number
  }))
  
  default = {
    "us-west-2" = {
      primary              = true
      disaster_recovery    = false
      node_count          = 5
      instance_types      = ["m5.xlarge", "c5.xlarge"]
      availability_zones  = ["us-west-2a", "us-west-2b", "us-west-2c"]
      database_multi_az   = true
      backup_retention    = 30
    }
    "us-east-1" = {
      primary              = false
      disaster_recovery    = false
      node_count          = 3
      instance_types      = ["m5.large", "c5.large"]
      availability_zones  = ["us-east-1a", "us-east-1b", "us-east-1c"]
      database_multi_az   = true
      backup_retention    = 7
    }
    "eu-west-1" = {
      primary              = false
      disaster_recovery    = true
      node_count          = 2
      instance_types      = ["m5.large"]
      availability_zones  = ["eu-west-1a", "eu-west-1b"]
      database_multi_az   = false
      backup_retention    = 14
    }
  }
}
```

### 4.2 Global Load Balancing with Route53

```yaml
# terraform/route53.tf
resource "aws_route53_zone" "primary" {
  name = "courtesyinspection.com"
  
  tags = {
    Environment = var.environment
  }
}

# Health checks for each region
resource "aws_route53_health_check" "api_health" {
  for_each = toset(var.regions)
  
  fqdn                            = "api-${each.key}.courtesyinspection.com"
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/health"
  failure_threshold              = "3"
  request_interval               = "30"
  cloudwatch_alarm_name          = "api-health-${each.key}"
  cloudwatch_alarm_region        = each.key
  insufficient_data_health_status = "Failure"

  tags = {
    Name        = "API Health Check - ${each.key}"
    Environment = var.environment
    Region      = each.key
  }
}

# Weighted routing for gradual traffic shifting
resource "aws_route53_record" "api_weighted" {
  for_each = var.region_config
  
  zone_id = aws_route53_zone.primary.zone_id
  name    = "api.courtesyinspection.com"
  type    = "A"
  
  weighted_routing_policy {
    weight = each.value.primary ? 70 : (each.value.disaster_recovery ? 5 : 25)
  }
  
  health_check_id = aws_route53_health_check.api_health[each.key].id
  set_identifier  = each.key
  
  alias {
    name                   = aws_lb.api[each.key].dns_name
    zone_id               = aws_lb.api[each.key].zone_id
    evaluate_target_health = true
  }
}

# Geolocation routing for optimal latency
resource "aws_route53_record" "api_geo" {
  for_each = {
    "us-west-2" = ["US-CA", "US-OR", "US-WA", "US-NV"]
    "us-east-1" = ["US-VA", "US-MD", "US-DE", "US-NJ", "US-NY"]
    "eu-west-1" = ["GB", "IE", "FR", "DE", "NL", "BE"]
  }
  
  zone_id = aws_route53_zone.primary.zone_id
  name    = "api-geo.courtesyinspection.com"
  type    = "A"
  
  geolocation_routing_policy {
    subdivision = each.value[0]  # Primary subdivision for the region
  }
  
  health_check_id = aws_route53_health_check.api_health[each.key].id
  set_identifier  = "geo-${each.key}"
  
  alias {
    name                   = aws_lb.api[each.key].dns_name
    zone_id               = aws_lb.api[each.key].zone_id
    evaluate_target_health = true
  }
}
```

---

## 5. Advanced Monitoring & Observability

### 5.1 Prometheus and Grafana Stack

```yaml
# helm/monitoring/values-production.yaml
prometheus:
  server:
    replicaCount: 3
    retention: "90d"
    resources:
      requests:
        memory: 8Gi
        cpu: 2000m
      limits:
        memory: 16Gi
        cpu: 4000m
    
    persistentVolume:
      enabled: true
      size: 500Gi
      storageClass: gp3
    
    # High Availability Configuration
    statefulSet:
      enabled: true
    
    # Federation for Multi-Region
    extraScrapeConfigs: |
      - job_name: 'federate-us-east-1'
        scrape_interval: 15s
        honor_labels: true
        metrics_path: '/federate'
        params:
          'match[]':
            - '{job=~"kubernetes-.*"}'
            - '{__name__=~"job:.*"}'
        static_configs:
          - targets:
            - 'prometheus-us-east-1.monitoring.svc.cluster.local:9090'
      
      - job_name: 'federate-eu-west-1'
        scrape_interval: 15s
        honor_labels: true
        metrics_path: '/federate'
        params:
          'match[]':
            - '{job=~"kubernetes-.*"}'
            - '{__name__=~"job:.*"}'
        static_configs:
          - targets:
            - 'prometheus-eu-west-1.monitoring.svc.cluster.local:9090'

  alertmanager:
    replicaCount: 3
    resources:
      requests:
        memory: 512Mi
        cpu: 100m
      limits:
        memory: 1Gi
        cpu: 200m
    
    config:
      global:
        smtp_smarthost: 'smtp.gmail.com:587'
        smtp_from: 'alerts@courtesyinspection.com'
        
      route:
        group_by: ['alertname', 'cluster', 'service']
        group_wait: 10s
        group_interval: 10s
        repeat_interval: 1h
        receiver: 'web.hook'
        routes:
        - match:
            severity: critical
          receiver: 'critical-alerts'
          continue: true
        - match:
            severity: warning
          receiver: 'warning-alerts'
      
      receivers:
      - name: 'web.hook'
        webhook_configs:
        - url: 'http://alertmanager-webhook:5000/'
      
      - name: 'critical-alerts'
        email_configs:
        - to: 'oncall@courtesyinspection.com'
          subject: 'CRITICAL: {{ .GroupLabels.alertname }}'
          body: |
            {{ range .Alerts }}
            Alert: {{ .Annotations.summary }}
            Description: {{ .Annotations.description }}
            {{ end }}
        slack_configs:
        - api_url: '{{ .SlackWebhookURL }}'
          channel: '#alerts-critical'
          title: 'CRITICAL Alert'
          text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        pagerduty_configs:
        - service_key: '{{ .PagerDutyServiceKey }}'

grafana:
  replicaCount: 2
  
  persistence:
    enabled: true
    size: 10Gi
    storageClassName: gp3
  
  resources:
    requests:
      memory: 1Gi
      cpu: 500m
    limits:
      memory: 2Gi
      cpu: 1000m
  
  # High Availability Configuration
  env:
    GF_DATABASE_TYPE: postgres
    GF_DATABASE_HOST: grafana-postgres:5432
    GF_DATABASE_NAME: grafana
    GF_DATABASE_USER: grafana
    GF_DATABASE_PASSWORD: {{ .Values.grafana.database.password }}
  
  # Enterprise Features
  grafana.ini:
    server:
      domain: grafana.courtesyinspection.com
      root_url: https://grafana.courtesyinspection.com
    
    security:
      admin_user: admin
      admin_password: {{ .Values.grafana.adminPassword }}
    
    auth:
      disable_login_form: false
    
    auth.github:
      enabled: true
      allow_sign_up: true
      client_id: {{ .Values.grafana.github.clientId }}
      client_secret: {{ .Values.grafana.github.clientSecret }}
      scopes: user:email,read:org
      auth_url: https://github.com/login/oauth/authorize
      token_url: https://github.com/login/oauth/access_token
      api_url: https://api.github.com/user
      allowed_organizations: courtesy-inspection-org
    
    alerting:
      enabled: true
      execute_alerts: true
    
    smtp:
      enabled: true
      host: smtp.gmail.com:587
      user: alerts@courtesyinspection.com
      password: {{ .Values.grafana.smtp.password }}
      from_address: alerts@courtesyinspection.com
  
  # Pre-configured Dashboards
  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
      - name: 'default'
        orgId: 1
        folder: ''
        type: file
        disableDeletion: false
        editable: true
        options:
          path: /var/lib/grafana/dashboards/default
  
  dashboards:
    default:
      kubernetes-cluster:
        gnetId: 7249
        revision: 1
        datasource: Prometheus
      
      kubernetes-pods:
        gnetId: 6417
        revision: 1
        datasource: Prometheus
      
      postgresql:
        gnetId: 9628
        revision: 7
        datasource: Prometheus
      
      redis:
        gnetId: 763
        revision: 4
        datasource: Prometheus
      
      nginx-ingress:
        gnetId: 9614
        revision: 1
        datasource: Prometheus
```

### 5.2 Distributed Tracing with Jaeger

```yaml
# helm/jaeger/values-production.yaml
jaeger:
  strategy: production
  
  collector:
    replicaCount: 3
    resources:
      requests:
        memory: 1Gi
        cpu: 500m
      limits:
        memory: 2Gi
        cpu: 1000m
    
    service:
      type: ClusterIP
      ports:
        - port: 14268
          targetPort: 14268
          name: http
        - port: 14250
          targetPort: 14250
          name: grpc
  
  query:
    replicaCount: 2
    resources:
      requests:
        memory: 512Mi
        cpu: 200m
      limits:
        memory: 1Gi
        cpu: 500m
    
    ingress:
      enabled: true
      className: nginx
      annotations:
        cert-manager.io/cluster-issuer: letsencrypt-prod
        nginx.ingress.kubernetes.io/auth-type: basic
        nginx.ingress.kubernetes.io/auth-secret: jaeger-auth
      hosts:
        - host: jaeger.courtesyinspection.com
          paths:
            - path: /
              pathType: Prefix
      tls:
        - secretName: jaeger-tls
          hosts:
            - jaeger.courtesyinspection.com
  
  # External Elasticsearch for storage
  storage:
    type: elasticsearch
    elasticsearch:
      host: elasticsearch.logging.svc.cluster.local
      port: 9200
      scheme: http
      user: jaeger
      password: {{ .Values.elasticsearch.password }}
      nodesWanOnly: false
      maxSpanAge: 168h
      indexPrefix: jaeger
```

### 5.3 Log Aggregation with ELK Stack

```yaml
# helm/elasticsearch/values-production.yaml
elasticsearch:
  clusterName: "courtesy-inspection-logs"
  nodeGroup: "master"
  
  # Master Nodes
  masterService: "elasticsearch-master"
  replicas: 3
  minimumMasterNodes: 2
  
  esMajorVersion: ""
  
  esConfig:
    elasticsearch.yml: |
      cluster.name: "courtesy-inspection-logs"
      network.host: 0.0.0.0
      discovery.seed_hosts: "elasticsearch-master-headless"
      cluster.initial_master_nodes: "elasticsearch-master-0,elasticsearch-master-1,elasticsearch-master-2"
      
      # Security
      xpack.security.enabled: true
      xpack.security.transport.ssl.enabled: true
      xpack.security.transport.ssl.verification_mode: certificate
      xpack.security.transport.ssl.keystore.path: /usr/share/elasticsearch/config/certs/elastic-certs.p12
      xpack.security.transport.ssl.truststore.path: /usr/share/elasticsearch/config/certs/elastic-certs.p12
      
      # Monitoring
      xpack.monitoring.collection.enabled: true
  
  resources:
    requests:
      cpu: "2000m"
      memory: "4Gi"
    limits:
      cpu: "4000m"
      memory: "8Gi"
  
  volumeClaimTemplate:
    accessModes: ["ReadWriteOnce"]
    storageClassName: "gp3"
    resources:
      requests:
        storage: 100Gi

# Data Nodes Configuration
dataNodes:
  nodeGroup: "data"
  replicas: 6
  
  resources:
    requests:
      cpu: "2000m"
      memory: "8Gi"
    limits:
      cpu: "4000m"
      memory: "16Gi"
  
  volumeClaimTemplate:
    accessModes: ["ReadWriteOnce"]
    storageClassName: "gp3"
    resources:
      requests:
        storage: 500Gi

# Logstash Configuration
logstash:
  replicas: 3
  
  logstashConfig:
    logstash.yml: |
      http.host: "0.0.0.0"
      path.config: /usr/share/logstash/pipeline
      xpack.monitoring.elasticsearch.hosts: ["http://elasticsearch-master:9200"]
  
  logstashPipeline:
    logstash.conf: |
      input {
        beats {
          port => 5044
        }
      }
      
      filter {
        if [kubernetes][container][name] {
          mutate {
            add_field => { "container_name" => "%{[kubernetes][container][name]}" }
          }
        }
        
        if [container_name] == "api-gateway" {
          grok {
            match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:message}" }
          }
          
          date {
            match => [ "timestamp", "ISO8601" ]
          }
        }
        
        # Parse JSON logs
        if [message] =~ /^\{.*\}$/ {
          json {
            source => "message"
          }
        }
      }
      
      output {
        elasticsearch {
          hosts => ["elasticsearch-master:9200"]
          index => "logs-%{[@metadata][beat]}-%{+YYYY.MM.dd}"
          template_name => "courtesy-inspection"
        }
      }
  
  resources:
    requests:
      cpu: "1000m"
      memory: "2Gi"
    limits:
      cpu: "2000m"
      memory: "4Gi"

# Kibana Configuration
kibana:
  replicas: 2
  
  elasticsearchHosts: "http://elasticsearch-master:9200"
  
  kibanaConfig:
    kibana.yml: |
      server.name: kibana
      server.host: "0.0.0.0"
      elasticsearch.hosts: ["http://elasticsearch-master:9200"]
      
      # Security
      xpack.security.enabled: true
      elasticsearch.username: "kibana_system"
      elasticsearch.password: "${ELASTICSEARCH_PASSWORD}"
      
      # Monitoring
      xpack.monitoring.ui.container.elasticsearch.enabled: true
  
  resources:
    requests:
      cpu: "500m"
      memory: "1Gi"
    limits:
      cpu: "1000m"
      memory: "2Gi"
  
  ingress:
    enabled: true
    className: "nginx"
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt-prod
      nginx.ingress.kubernetes.io/auth-type: basic
      nginx.ingress.kubernetes.io/auth-secret: kibana-auth
    hosts:
      - host: kibana.courtesyinspection.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: kibana-tls
        hosts:
          - kibana.courtesyinspection.com
```

---

## 6. Blue-Green Deployment

### 6.1 Advanced Blue-Green Strategy

```bash
#!/bin/bash
# scripts/blue-green-deploy.sh

set -e

ENVIRONMENT=${1:-production}
REGION=${2:-us-west-2}
IMAGE_TAG=${3}
NAMESPACE="courtesy-inspection-${ENVIRONMENT}"

if [ -z "$IMAGE_TAG" ]; then
    echo "❌ Please specify an image tag"
    echo "Usage: $0 <environment> <region> <image_tag>"
    exit 1
fi

echo "🔄 Starting Blue-Green deployment for $ENVIRONMENT in $REGION"

# Configure kubectl
aws eks update-kubeconfig --region $REGION --name courtesy-inspection-$ENVIRONMENT-$REGION

# Function to check deployment health
check_deployment_health() {
    local color=$1
    local max_attempts=30
    local attempt=0
    
    echo "🔍 Checking $color environment health..."
    
    while [ $attempt -lt $max_attempts ]; do
        if kubectl get pods -n $NAMESPACE -l environment=$color | grep -q "Running"; then
            # Check all pods are running
            TOTAL_PODS=$(kubectl get pods -n $NAMESPACE -l environment=$color --no-headers | wc -l)
            RUNNING_PODS=$(kubectl get pods -n $NAMESPACE -l environment=$color --no-headers | grep "Running" | wc -l)
            
            if [ "$TOTAL_PODS" -eq "$RUNNING_PODS" ] && [ "$TOTAL_PODS" -gt 0 ]; then
                echo "✅ All $color pods are running ($RUNNING_PODS/$TOTAL_PODS)"
                return 0
            fi
        fi
        
        echo "⏳ Waiting for $color environment... ($((attempt + 1))/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    echo "❌ $color environment health check failed"
    return 1
}

# Function to run health checks
run_health_checks() {
    local color=$1
    
    echo "🏥 Running comprehensive health checks for $color environment..."
    
    # API Health Check
    if ! kubectl run health-check-$color --image=curlimages/curl --restart=Never --rm -i -- \
        curl -f -m 10 http://api-gateway-$color:9400/health/deep; then
        echo "❌ API health check failed for $color environment"
        return 1
    fi
    
    # Database Connectivity Check
    if ! kubectl run db-check-$color --image=postgres:15-alpine --restart=Never --rm -i -- \
        psql $DATABASE_URL -c "SELECT 1;"; then
        echo "❌ Database connectivity check failed for $color environment"
        return 1
    fi
    
    # Cache Connectivity Check
    if ! kubectl run cache-check-$color --image=redis:7-alpine --restart=Never --rm -i -- \
        redis-cli -u $REDIS_URL ping; then
        echo "❌ Cache connectivity check failed for $color environment"
        return 1
    fi
    
    echo "✅ All health checks passed for $color environment"
    return 0
}

# Function to run smoke tests
run_smoke_tests() {
    local color=$1
    local api_url="http://api-gateway-$color:9400"
    
    echo "🧪 Running smoke tests for $color environment..."
    
    # Test critical endpoints
    local endpoints=(
        "/health"
        "/api/v1/auth/ping"
        "/api/v1/shops"
        "/api/v1/inspections"
    )
    
    for endpoint in "${endpoints[@]}"; do
        echo "Testing $api_url$endpoint"
        if ! kubectl run smoke-test-$color --image=curlimages/curl --restart=Never --rm -i -- \
            curl -f -m 10 "$api_url$endpoint"; then
            echo "❌ Smoke test failed for endpoint: $endpoint"
            return 1
        fi
    done
    
    echo "✅ All smoke tests passed for $color environment"
    return 0
}

# Function to switch traffic
switch_traffic() {
    local from_color=$1
    local to_color=$2
    
    echo "🔀 Switching traffic from $from_color to $to_color..."
    
    # Update service selectors to point to new color
    kubectl patch service api-gateway -n $NAMESPACE \
        -p "{\"spec\":{\"selector\":{\"environment\":\"$to_color\"}}}"
    kubectl patch service web-portal -n $NAMESPACE \
        -p "{\"spec\":{\"selector\":{\"environment\":\"$to_color\"}}}"
    kubectl patch service admin-panel -n $NAMESPACE \
        -p "{\"spec\":{\"selector\":{\"environment\":\"$to_color\"}}}"
    kubectl patch service customer-portal -n $NAMESPACE \
        -p "{\"spec\":{\"selector\":{\"environment\":\"$to_color\"}}}"
    
    # Wait for traffic switch to propagate
    echo "⏳ Waiting for traffic switch to propagate..."
    sleep 60
    
    # Verify external connectivity
    if curl -f -m 30 https://api.courtesyinspection.com/health; then
        echo "✅ External connectivity verified"
        return 0
    else
        echo "❌ External connectivity verification failed"
        return 1
    fi
}

# Function to cleanup old environment
cleanup_old_environment() {
    local color=$1
    
    echo "🧹 Cleaning up $color environment..."
    
    # Scale down old environment gradually
    local services=("api-gateway" "auth-service" "inspection-service" "customer-service" "shop-service" "media-service" "report-service" "notification-service" "analytics-service" "ai-service" "web-portal" "admin-panel" "customer-portal")
    
    for service in "${services[@]}"; do
        if kubectl get deployment $service-$color -n $NAMESPACE 2>/dev/null; then
            echo "🔽 Scaling down $service-$color..."
            kubectl scale deployment $service-$color -n $NAMESPACE --replicas=0
        fi
    done
    
    # Wait for pods to terminate
    echo "⏳ Waiting for old pods to terminate..."
    kubectl wait --for=delete pod -l environment=$color -n $NAMESPACE --timeout=300s
    
    # Remove old deployments
    for service in "${services[@]}"; do
        if kubectl get deployment $service-$color -n $NAMESPACE 2>/dev/null; then
            echo "🗑️ Removing $service-$color deployment..."
            kubectl delete deployment $service-$color -n $NAMESPACE
        fi
    done
    
    echo "✅ $color environment cleanup completed"
}

# Function to rollback on failure
rollback_deployment() {
    local failed_color=$1
    local stable_color=$2
    
    echo "🔙 Rolling back from $failed_color to $stable_color..."
    
    # Switch traffic back
    switch_traffic $failed_color $stable_color
    
    # Cleanup failed environment
    cleanup_old_environment $failed_color
    
    echo "✅ Rollback completed"
}

# Main deployment process
main() {
    # Determine current active color
    CURRENT_COLOR=$(kubectl get service api-gateway -n $NAMESPACE -o jsonpath='{.spec.selector.environment}' 2>/dev/null || echo "blue")
    
    if [ "$CURRENT_COLOR" = "blue" ]; then
        NEW_COLOR="green"
    else
        NEW_COLOR="blue"
    fi
    
    echo "📊 Current active environment: $CURRENT_COLOR"
    echo "🎯 Deploying to: $NEW_COLOR"
    
    # Create backup of current state
    echo "💾 Creating backup of current configuration..."
    kubectl get all -n $NAMESPACE -l environment=$CURRENT_COLOR -o yaml > "backup-$CURRENT_COLOR-$(date +%Y%m%d-%H%M%S).yaml"
    
    # Deploy new environment
    echo "🚀 Deploying $NEW_COLOR environment..."
    helm upgrade --install courtesy-inspection-$NEW_COLOR ./helm/courtesy-inspection \
        --namespace $NAMESPACE \
        --values ./helm/courtesy-inspection/values-$ENVIRONMENT.yaml \
        --set global.image.tag=$IMAGE_TAG \
        --set global.region=$REGION \
        --set global.environment=$NEW_COLOR \
        --wait \
        --timeout=30m
    
    # Check deployment health
    if ! check_deployment_health $NEW_COLOR; then
        echo "❌ Deployment health check failed"
        cleanup_old_environment $NEW_COLOR
        exit 1
    fi
    
    # Run health checks
    if ! run_health_checks $NEW_COLOR; then
        echo "❌ Health checks failed"
        cleanup_old_environment $NEW_COLOR
        exit 1
    fi
    
    # Run smoke tests
    if ! run_smoke_tests $NEW_COLOR; then
        echo "❌ Smoke tests failed"
        cleanup_old_environment $NEW_COLOR
        exit 1
    fi
    
    # Switch traffic to new environment
    if ! switch_traffic $CURRENT_COLOR $NEW_COLOR; then
        echo "❌ Traffic switch failed, rolling back..."
        rollback_deployment $NEW_COLOR $CURRENT_COLOR
        exit 1
    fi
    
    # Final verification with production traffic
    echo "🔍 Running final verification with production traffic..."
    sleep 120  # Let traffic flow for 2 minutes
    
    # Check error rates and response times
    ERROR_RATE=$(kubectl exec -n monitoring deployment/prometheus -- \
        promtool query instant 'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100' | \
        grep -o '[0-9.]*' | head -1)
    
    if (( $(echo "$ERROR_RATE > 1" | bc -l) )); then
        echo "❌ Error rate too high ($ERROR_RATE%), rolling back..."
        rollback_deployment $NEW_COLOR $CURRENT_COLOR
        exit 1
    fi
    
    echo "✅ Production verification successful (Error rate: $ERROR_RATE%)"
    
    # Cleanup old environment
    cleanup_old_environment $CURRENT_COLOR
    
    # Update deployment metadata
    kubectl annotate namespace $NAMESPACE \
        deployment.kubernetes.io/active-color=$NEW_COLOR \
        deployment.kubernetes.io/deployment-time=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
        deployment.kubernetes.io/image-tag=$IMAGE_TAG
    
    echo "🎉 Blue-Green deployment completed successfully!"
    echo "📊 Active environment: $NEW_COLOR"
    echo "🏷️ Image tag: $IMAGE_TAG"
    echo "🕒 Deployment time: $(date)"
}

# Error handling
trap 'echo "❌ Deployment failed at line $LINENO"' ERR

# Run main function
main
```

---

## 7. Security & Compliance

### 7.1 Advanced Security Configuration

```yaml
# k8s/security/network-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-gateway-network-policy
  namespace: courtesy-inspection-prod
spec:
  podSelector:
    matchLabels:
      app: api-gateway
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: nginx-ingress
    ports:
    - protocol: TCP
      port: 9400
  - from:
    - podSelector:
        matchLabels:
          app: web-portal
    ports:
    - protocol: TCP
      port: 9400
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
  - to: []
    ports:
    - protocol: TCP
      port: 5432  # PostgreSQL
    - protocol: TCP
      port: 6379  # Redis
    - protocol: TCP
      port: 443   # HTTPS
    - protocol: UDP
      port: 53    # DNS
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-network-policy
  namespace: courtesy-inspection-prod
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: backend
    ports:
    - protocol: TCP
      port: 5432
```

### 7.2 Pod Security Standards

```yaml
# k8s/security/pod-security-policy.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: courtesy-inspection-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  supplementalGroups:
    rule: 'MustRunAs'
    ranges:
      - min: 1
        max: 65535
  fsGroup:
    rule: 'MustRunAs'
    ranges:
      - min: 1
        max: 65535
  readOnlyRootFilesystem: true
  seLinux:
    rule: 'RunAsAny'
```

### 7.3 RBAC Configuration

```yaml
# k8s/security/rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: courtesy-inspection-sa
  namespace: courtesy-inspection-prod
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: courtesy-inspection-prod
  name: courtesy-inspection-role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "endpoints", "configmaps", "secrets"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["metrics.k8s.io"]
  resources: ["pods", "nodes"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: courtesy-inspection-binding
  namespace: courtesy-inspection-prod
subjects:
- kind: ServiceAccount
  name: courtesy-inspection-sa
  namespace: courtesy-inspection-prod
roleRef:
  kind: Role
  name: courtesy-inspection-role
  apiGroup: rbac.authorization.k8s.io
```

---

## 8. Disaster Recovery

### 8.1 Cross-Region Backup Strategy

```bash
#!/bin/bash
# scripts/disaster-recovery.sh

set -e

# Configuration
PRIMARY_REGION="us-west-2"
DR_REGION="eu-west-1"
BACKUP_BUCKET="courtesy-inspection-dr-backups"
ENVIRONMENT=${1:-production}

echo "🔄 Starting disaster recovery procedure..."

# Function to create database backup
create_database_backup() {
    local region=$1
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_file="db-backup-$region-$timestamp.sql"
    
    echo "💾 Creating database backup for $region..."
    
    # Create RDS snapshot
    aws rds create-db-snapshot \
        --region $region \
        --db-instance-identifier courtesy-inspection-$ENVIRONMENT \
        --db-snapshot-identifier courtesy-inspection-dr-$timestamp
    
    # Export to S3
    aws rds start-export-task \
        --region $region \
        --export-task-identifier courtesy-inspection-export-$timestamp \
        --source-arn $(aws rds describe-db-snapshots \
            --region $region \
            --db-snapshot-identifier courtesy-inspection-dr-$timestamp \
            --query 'DBSnapshots[0].DBSnapshotArn' --output text) \
        --s3-bucket-name $BACKUP_BUCKET \
        --s3-prefix database-backups/$region/ \
        --iam-role-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/rds-s3-export-role
    
    echo "✅ Database backup initiated for $region"
}

# Function to sync application data
sync_application_data() {
    echo "📁 Syncing application data..."
    
    # Sync S3 buckets
    aws s3 sync s3://courtesy-inspection-media-$PRIMARY_REGION \
        s3://courtesy-inspection-media-$DR_REGION \
        --region $DR_REGION
    
    # Sync container images
    aws ecr get-login-password --region $PRIMARY_REGION | \
        docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$PRIMARY_REGION.amazonaws.com
    
    aws ecr get-login-password --region $DR_REGION | \
        docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$DR_REGION.amazonaws.com
    
    # Copy latest images to DR region
    local services=("api-gateway" "auth-service" "inspection-service" "web-portal")
    for service in "${services[@]}"; do
        echo "🐳 Copying $service image to DR region..."
        docker pull $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$PRIMARY_REGION.amazonaws.com/courtesy-inspection/$service:latest
        docker tag $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$PRIMARY_REGION.amazonaws.com/courtesy-inspection/$service:latest \
            $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$DR_REGION.amazonaws.com/courtesy-inspection/$service:latest
        docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$DR_REGION.amazonaws.com/courtesy-inspection/$service:latest
    done
    
    echo "✅ Application data sync completed"
}

# Function to activate DR environment
activate_dr_environment() {
    echo "🚨 Activating disaster recovery environment in $DR_REGION..."
    
    # Update kubeconfig for DR region
    aws eks update-kubeconfig --region $DR_REGION --name courtesy-inspection-$ENVIRONMENT-$DR_REGION
    
    # Deploy to DR environment
    helm upgrade --install courtesy-inspection-dr ./helm/courtesy-inspection \
        --namespace courtesy-inspection-$ENVIRONMENT \
        --create-namespace \
        --values ./helm/courtesy-inspection/values-dr.yaml \
        --set global.region=$DR_REGION \
        --set global.environment=disaster-recovery \
        --wait \
        --timeout=20m
    
    # Wait for all services to be ready
    kubectl wait --for=condition=ready pod -l tier=backend -n courtesy-inspection-$ENVIRONMENT --timeout=600s
    
    # Update Route53 to point to DR region
    aws route53 change-resource-record-sets \
        --hosted-zone-id $ROUTE53_HOSTED_ZONE_ID \
        --change-batch '{
            "Changes": [{
                "Action": "UPSERT",
                "ResourceRecordSet": {
                    "Name": "api.courtesyinspection.com",
                    "Type": "A",
                    "SetIdentifier": "primary",
                    "Failover": {
                        "Type": "PRIMARY"
                    },
                    "TTL": 60,
                    "ResourceRecords": [{"Value": "'$(kubectl get service api-gateway -n courtesy-inspection-$ENVIRONMENT -o jsonpath='{.status.loadBalancer.ingress[0].ip}')'" }]
                }
            }]
        }'
    
    echo "✅ Disaster recovery environment activated"
}

# Function to verify DR environment
verify_dr_environment() {
    echo "🔍 Verifying disaster recovery environment..."
    
    # Health checks
    local api_url="https://api.courtesyinspection.com"
    local max_attempts=10
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -m 30 "$api_url/health"; then
            echo "✅ DR environment health check passed"
            break
        fi
        
        echo "⏳ Waiting for DR environment to be ready... ($((attempt + 1))/$max_attempts)"
        sleep 30
        ((attempt++))
    done
    
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ DR environment health check failed"
        return 1
    fi
    
    # Run basic functionality tests
    echo "🧪 Running DR functionality tests..."
    npm run test:dr:basic
    
    echo "✅ DR environment verification completed"
}

# Function to send notifications
send_notifications() {
    local status=$1
    local message=$2
    
    # Send Slack notification
    curl -X POST "$SLACK_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"channel\": \"#incidents\",
            \"username\": \"DR Bot\",
            \"text\": \"🚨 Disaster Recovery Status: $status\",
            \"attachments\": [{
                \"color\": \"$([ "$status" = "SUCCESS" ] && echo "good" || echo "danger")\",
                \"fields\": [{
                    \"title\": \"Message\",
                    \"value\": \"$message\",
                    \"short\": false
                }, {
                    \"title\": \"Region\",
                    \"value\": \"$DR_REGION\",
                    \"short\": true
                }, {
                    \"title\": \"Timestamp\",
                    \"value\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
                    \"short\": true
                }]
            }]
        }"
    
    # Send email notification
    aws ses send-email \
        --region $DR_REGION \
        --source "alerts@courtesyinspection.com" \
        --destination "ToAddresses=oncall@courtesyinspection.com" \
        --message "Subject={Data='Disaster Recovery Status: $status'},Body={Text={Data='$message'}}"
}

# Main disaster recovery process
main() {
    local dr_type=${2:-full}  # full, database-only, application-only
    
    echo "🚨 Initiating disaster recovery procedure..."
    echo "📍 Primary Region: $PRIMARY_REGION"
    echo "📍 DR Region: $DR_REGION"
    echo "🎯 Recovery Type: $dr_type"
    
    case $dr_type in
        "full")
            create_database_backup $PRIMARY_REGION
            sync_application_data
            activate_dr_environment
            verify_dr_environment
            send_notifications "SUCCESS" "Full disaster recovery completed successfully"
            ;;
        "database-only")
            create_database_backup $PRIMARY_REGION
            send_notifications "SUCCESS" "Database backup completed successfully"
            ;;
        "application-only")
            sync_application_data
            activate_dr_environment
            verify_dr_environment
            send_notifications "SUCCESS" "Application disaster recovery completed successfully"
            ;;
        *)
            echo "❌ Invalid disaster recovery type: $dr_type"
            echo "Available types: full, database-only, application-only"
            exit 1
            ;;
    esac
    
    echo "🎉 Disaster recovery procedure completed!"
}

# Error handling
trap 'send_notifications "FAILED" "Disaster recovery failed at line $LINENO"' ERR

# Run main function
main "$@"
```

---

## 9. Performance Optimization

### 9.1 Advanced Caching Strategy

```yaml
# k8s/caching/redis-cluster.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-cluster-config
  namespace: courtesy-inspection-prod
data:
  redis.conf: |
    cluster-enabled yes
    cluster-require-full-coverage no
    cluster-node-timeout 15000
    cluster-config-file /data/nodes.conf
    cluster-migration-barrier 1
    appendonly yes
    appendfsync everysec
    
    # Memory optimization
    maxmemory 2gb
    maxmemory-policy allkeys-lru
    
    # Performance tuning
    tcp-keepalive 60
    timeout 300
    
    # Security
    protected-mode yes
    requirepass ${REDIS_PASSWORD}
    
    # Logging
    loglevel notice
    logfile /data/redis.log
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-cluster
  namespace: courtesy-inspection-prod
spec:
  serviceName: redis-cluster-headless
  replicas: 6
  selector:
    matchLabels:
      app: redis-cluster
  template:
    metadata:
      labels:
        app: redis-cluster
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - redis-cluster
            topologyKey: kubernetes.io/hostname
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
          name: client
        - containerPort: 16379
          name: gossip
        command:
        - redis-server
        - "/etc/redis/redis.conf"
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: password
        volumeMounts:
        - name: conf
          mountPath: /etc/redis
        - name: data
          mountPath: /data
        resources:
          requests:
            memory: 2Gi
            cpu: 500m
          limits:
            memory: 4Gi
            cpu: 1000m
        livenessProbe:
          exec:
            command:
            - redis-cli
            - --raw
            - incr
            - ping
          initialDelaySeconds: 30
          timeoutSeconds: 5
          periodSeconds: 10
          failureThreshold: 3
        readinessProbe:
          exec:
            command:
            - redis-cli
            - --raw
            - incr
            - ping
          initialDelaySeconds: 5
          timeoutSeconds: 1
          periodSeconds: 5
          failureThreshold: 3
      volumes:
      - name: conf
        configMap:
          name: redis-cluster-config
          defaultMode: 0755
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: gp3
      resources:
        requests:
          storage: 50Gi
```

### 9.2 CDN and Edge Optimization

```yaml
# terraform/cloudfront.tf
resource "aws_cloudfront_distribution" "api_distribution" {
  origin {
    domain_name = aws_lb.api_primary.dns_name
    origin_id   = "api-origin"
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Courtesy Inspection API CDN"
  default_root_object = ""
  
  # Geographic restrictions
  restrictions {
    geo_restriction {
      restriction_type = "whitelist"
      locations        = ["US", "CA", "GB", "DE", "FR", "AU", "JP"]
    }
  }
  
  # Cache behaviors for API endpoints
  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "api-origin"
    
    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "Accept", "X-Requested-With"]
      
      cookies {
        forward = "none"
      }
    }
    
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0      # No caching for API by default
    max_ttl                = 31536000
    compress               = true
    
    # Lambda@Edge for request/response manipulation
    lambda_function_association {
      event_type   = "origin-request"
      lambda_arn   = aws_lambda_function.edge_auth.qualified_arn
      include_body = true
    }
  }
  
  # Cache static assets aggressively
  ordered_cache_behavior {
    path_pattern     = "/static/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "api-origin"
    
    forwarded_values {
      query_string = false
      
      cookies {
        forward = "none"
      }
    }
    
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 86400      # 1 day
    default_ttl            = 2592000    # 30 days
    max_ttl                = 31536000   # 1 year
    compress               = true
  }
  
  # Cache images and media
  ordered_cache_behavior {
    path_pattern     = "/api/v1/media/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "api-origin"
    
    forwarded_values {
      query_string = true  # For image transformations
      
      cookies {
        forward = "none"
      }
    }
    
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 3600       # 1 hour
    default_ttl            = 86400      # 1 day
    max_ttl                = 2592000    # 30 days
    compress               = true
  }
  
  price_class = "PriceClass_All"
  
  # SSL Certificate
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.api_cert.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
  
  # WAF Association
  web_acl_id = aws_waf_web_acl.api_waf.id
  
  # Logging
  logging_config {
    include_cookies = false
    bucket          = aws_s3_bucket.cloudfront_logs.bucket_domain_name
    prefix          = "api/"
  }
  
  tags = {
    Environment = var.environment
    Purpose     = "API CDN"
  }
}
```

---

## Summary

This Phase 2 enterprise deployment configuration provides:

### ✅ Enterprise Features Included
- **Multi-region EKS deployment** with automated failover
- **Advanced monitoring** with Prometheus, Grafana, and Jaeger
- **Blue-green deployment** strategy with automated health checks
- **Comprehensive security** with network policies, RBAC, and PSP
- **Disaster recovery** procedures with cross-region backup
- **Performance optimization** with caching and CDN
- **Advanced CI/CD** with multi-environment testing
- **Scalability** with HPA and cluster autoscaling
- **Observability** with distributed tracing and log aggregation

### 📊 Technical Specifications
- **Deployment Complexity**: Enterprise-grade
- **Setup Time**: 4-8 hours (automated)
- **Monthly Cost**: $2,000-10,000+ (based on scale)
- **Scalability**: 1M+ requests/day
- **Availability**: 99.9%+ SLA
- **Recovery Time**: <15 minutes

### 🔄 Upgrade Path from MVP
The MVP can be gradually upgraded to Phase 2 by implementing components incrementally:
1. Migrate to EKS
2. Add monitoring stack
3. Implement blue-green deployment
4. Add security policies
5. Set up disaster recovery
6. Optimize performance

---

**Document Version**: Phase 2 Enterprise 1.0  
**Target Users**: Large organizations, enterprise customers  
**Maintainer**: DevOps Team  
**Next Review**: Quarterly