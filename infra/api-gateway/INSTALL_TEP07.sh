#!/bin/bash
# TEP-07: Installation des dépendances GraphQL et REST API
# Date: 2025-11-27

set -euo pipefail

echo "[1/4] Installation des packages GraphQL..."
npm install @nestjs/graphql@^10.1.7 @nestjs/apollo@^12.0.11 @apollo/server@^4.9.5 graphql@^16.8.1

echo "[2/4] Installation des packages validation..."
npm install class-validator@^0.14.0 class-transformer@^0.5.1

echo "[3/4] Installation des packages types..."
npm install --save-dev @types/node@^20.10.6

echo "[4/4] Rebuild du projet..."
npm run build

echo ""
echo "✅ Installation terminée avec succès !"
echo ""
echo "Prochaines étapes:"
echo "  1. Redémarrer l'API Gateway: docker-compose restart api-gateway"
echo "  2. Tester GraphQL: http://localhost:3000/graphql"
echo "  3. Tester REST: http://localhost:3000/api"
echo ""
