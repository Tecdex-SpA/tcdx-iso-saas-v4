# Oracle Cloud VM Setup — TCDX ISO SaaS

## Convenciones

```bash
sudo adduser tecdex
sudo usermod -aG sudo tecdex
```

Rutas estándar:

```text
/home/tecdex/backend
/home/tecdex/frontend
/home/tecdex/ai-engine
/home/tecdex/backups
```

## VM 1 — PostgreSQL

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y postgresql postgresql-contrib
```

`postgresql.conf`:

```conf
listen_addresses = '<db-private-ip>'
```

`pg_hba.conf`:

```conf
host tecdex_saas <db_user> <backend-private-ip>/32 md5
host tecdex_saas <db_user> <ai-engine-private-ip>/32 md5
```

```bash
sudo -u postgres psql
CREATE USER <db_user> WITH PASSWORD '<db_password>';
CREATE DATABASE tecdex_saas OWNER <db_user>;
\q
```

```bash
pg_restore -h <db-private-ip> -U <db_user> -d tecdex_saas --clean --if-exists /tmp/tecdex_saas.dump
```

## VM 2 — Backend

```bash
sudo apt install -y git curl ca-certificates build-essential
# Instalar Node.js LTS según política del proyecto.
sudo mkdir -p /home/tecdex/backend
sudo chown -R tecdex:tecdex /home/tecdex/backend
cd /home/tecdex
git clone <repo-url> repo
rsync -a repo/backend/ /home/tecdex/backend/
cd /home/tecdex/backend
npm install
cp .env.example .env
chmod 600 .env
nano .env
sudo cp /home/tecdex/repo/deploy/templates/systemd/tecdex-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tecdex-backend
sudo systemctl restart tecdex-backend
curl -I http://127.0.0.1:3000/
```

## VM 3 — Frontend + Nginx

```bash
sudo apt install -y git curl ca-certificates build-essential nginx
# Instalar Node.js LTS según política del proyecto.
sudo mkdir -p /home/tecdex/frontend
sudo chown -R tecdex:tecdex /home/tecdex/frontend
cd /home/tecdex
git clone <repo-url> repo
rsync -a repo/frontend/ /home/tecdex/frontend/
cd /home/tecdex/frontend
npm install
npm run build
cp .env.example .env
chmod 600 .env
nano .env
sudo cp /home/tecdex/repo/deploy/templates/systemd/tecdex-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tecdex-frontend
sudo systemctl restart tecdex-frontend
curl -I http://127.0.0.1:8080/login
```

Nginx:

```bash
sudo cp /home/tecdex/repo/deploy/templates/nginx/tcdx-frontend-http.conf /etc/nginx/sites-available/tcdx-frontend.conf
sudo ln -sf /etc/nginx/sites-available/tcdx-frontend.conf /etc/nginx/sites-enabled/tcdx-frontend.conf
sudo nginx -t
sudo systemctl reload nginx
```

Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d compliance.tcdx.cl
```

## VM 4 — AI Engine

```bash
sudo apt install -y git curl ca-certificates python3 python3-venv python3-pip build-essential
sudo mkdir -p /home/tecdex/ai-engine
sudo chown -R tecdex:tecdex /home/tecdex/ai-engine
cd /home/tecdex
git clone <repo-url> repo
rsync -a repo/ai-engine/ /home/tecdex/ai-engine/
cd /home/tecdex/ai-engine
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
chmod 600 .env
nano .env
sudo cp /home/tecdex/repo/deploy/templates/systemd/ai-engine.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ai-engine
sudo systemctl restart ai-engine
curl -I http://127.0.0.1:8000/health
```
