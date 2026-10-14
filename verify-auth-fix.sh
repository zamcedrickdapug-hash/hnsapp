#!/bin/bash

# Authentication System 500 Error - Quick Verification
# Usage: bash verify-auth-fix.sh

echo "=========================================="
echo "  Authentication System Verification"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_result() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: $1"
  else
    echo -e "${RED}✗ FAIL${NC}: $1"
  fi
}

# 1. Check backend .env exists
echo "1. Checking backend configuration..."
if [ -f "backend/.env" ]; then
  echo -e "${GREEN}✓${NC} backend/.env found"
else
  echo -e "${RED}✗${NC} backend/.env NOT found"
  exit 1
fi

# 2. Check required environment variables
echo ""
echo "2. Verifying environment variables..."

required_vars=("MONGO_URL" "JWT_SECRET" "SMTP_HOST" "SMTP_PORT" "SMTP_USERNAME" "SMTP_PASSWORD" "MAIL_FROM_EMAIL" "FRONTEND_URL")

for var in "${required_vars[@]}"; do
  if grep -q "^${var}=" backend/.env; then
    value=$(grep "^${var}=" backend/.env | cut -d'=' -f2)
    if [ -z "$value" ]; then
      echo -e "${RED}✗${NC} ${var} is empty"
    else
      echo -e "${GREEN}✓${NC} ${var} is set"
    fi
  else
    echo -e "${YELLOW}⚠${NC} ${var} not found in .env"
  fi
done

# 3. Check if Node.js version is compatible
echo ""
echo "3. Checking Node.js version..."
if command -v node &> /dev/null; then
  node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$node_version" -ge 20 ]; then
    echo -e "${GREEN}✓${NC} Node.js $(node -v) is compatible"
  else
    echo -e "${YELLOW}⚠${NC} Node.js $(node -v) is old (recommended: v20+)"
  fi
else
  echo -e "${RED}✗${NC} Node.js not found"
fi

# 4. Check required files exist
echo ""
echo "4. Checking required backend files..."

files=(
  "backend/middleware/auth.js"
  "backend/routes/auth.routes.js"
  "backend/utils/passwordReset.js"
  "backend/models/User.js"
  "backend/index.js"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $file exists"
  else
    echo -e "${RED}✗${NC} $file NOT found"
  fi
done

# 5. Check MongoDB connection string format
echo ""
echo "5. Verifying MongoDB connection string..."
if grep -q "^MONGO_URL=mongodb" backend/.env; then
  echo -e "${GREEN}✓${NC} MongoDB URL format looks valid"
else
  echo -e "${RED}✗${NC} MongoDB URL format is invalid"
fi

# 6. Check for placeholder values
echo ""
echo "6. Checking for placeholder values..."
placeholders=("your-secret-key-here" "<db_password>" "<username>" "<password>")

for placeholder in "${placeholders[@]}"; do
  if grep -qi "$placeholder" backend/.env; then
    echo -e "${YELLOW}⚠${NC} Placeholder '$placeholder' found in .env"
  fi
done
echo -e "${GREEN}✓${NC} No obvious placeholders detected"

# 7. Check if npm dependencies are installed
echo ""
echo "7. Checking npm dependencies..."
if [ -d "backend/node_modules" ]; then
  echo -e "${GREEN}✓${NC} backend/node_modules exists"
else
  echo -e "${YELLOW}⚠${NC} backend/node_modules not found (run: cd backend && npm install)"
fi

if [ -d "frontend/node_modules" ]; then
  echo -e "${GREEN}✓${NC} frontend/node_modules exists"
else
  echo -e "${YELLOW}⚠${NC} frontend/node_modules not found (run: cd frontend && npm install)"
fi

# 8. Summary
echo ""
echo "=========================================="
echo "  Verification Summary"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Start backend:    cd backend && npm run dev"
echo "2. Start frontend:   cd frontend && npm run dev"
echo "3. Check /api/health in browser"
echo "4. Test /api/auth/me with valid token"
echo ""
echo "Testing:"
echo "- Visit: http://localhost:5173"
echo "- Try login or forgot password"
echo "- Check browser console and terminal logs"
echo ""
