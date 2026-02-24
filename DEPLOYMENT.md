# Deploying FamiTree to the Internet

This guide explains how to build and deploy FamiTree so it is accessible on the public internet.

---

## Prerequisites

- **Docker** installed on your machine or server ([Install Docker](https://docs.docker.com/get-docker/))
- A **server** or **hosting** with a public IP (VPS, cloud VM, or PaaS)
- (Recommended) A **domain name** and **HTTPS** for security

---

## 1. Build and run with Docker

### Build the image

From the project root:

```bash
docker build -t famitree .
```

### Run the container

**Basic run** (database is lost when the container is removed):

```bash
docker run -p 3000:3000 famitree
```

**Run with persistent database** (recommended):

```bash
docker run -d \
  --name famitree \
  -p 3000:3000 \
  -v famitree-data:/app/data \
  --restart unless-stopped \
  famitree
```

- `-d`: run in background  
- `-p 3000:3000`: map host port 3000 to container port 3000  
- `-v famitree-data:/app/data`: persist the SQLite database in a Docker volume  
- `--restart unless-stopped`: restart the container after reboot  

Open **http://localhost:3000** (or your server’s IP) to use the app.

### Change the port

To listen on port 8080 instead:

```bash
docker run -d -p 8080:8080 -e PORT=8080 -v famitree-data:/app/data --restart unless-stopped famitree
```

---

## 2. Deploy on a VPS (e.g. Ubuntu)

Use a VPS from DigitalOcean, Linode, Hetzner, AWS, etc.

### 2.1 Prepare the server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Log out and back in so the group takes effect
```

### 2.2 Deploy the app

**Option A: Build on the server**

Copy the project to the server (e.g. with `git clone` or `scp`), then:

```bash
cd famitree
docker build -t famitree .
docker run -d --name famitree -p 3000:3000 -v famitree-data:/app/data --restart unless-stopped famitree
```

**Option B: Build on your PC and push to a registry**

```bash
# On your machine: build and tag for a registry
docker build -t your-registry.com/famitree:1.0 .
docker push your-registry.com/famitree:1.0

# On the server: pull and run
docker pull your-registry.com/famitree:1.0
docker run -d --name famitree -p 3000:3000 -v famitree-data:/app/data --restart unless-stopped your-registry.com/famitree:1.0
```

### 2.3 Open the app on the internet

- In your cloud provider’s dashboard, open **port 3000** (or the port you use) in the firewall / security group.
- Visit **http://YOUR_SERVER_IP:3000**.

For production, put the app behind a reverse proxy and use HTTPS (see next section).

---

## 3. HTTPS with a domain (recommended)

To use a domain (e.g. `famitree.example.com`) and HTTPS:

1. Point your domain’s DNS **A record** to your server’s IP.
2. Install a reverse proxy and get an SSL certificate.

### Example: Nginx + Let’s Encrypt (Ubuntu/Debian)

```bash
# Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Get a certificate (replace famitree.example.com with your domain)
sudo certbot --nginx -d famitree.example.com
```

Create an Nginx site config, e.g. `/etc/nginx/sites-available/famitree`:

```nginx
server {
    listen 80;
    server_name famitree.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name famitree.example.com;

    ssl_certificate     /etc/letsencrypt/live/famitree.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/famitree.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/famitree /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Certbot can also create a basic HTTPS config for you; adjust the `proxy_pass` port if your container uses something other than 3000.

---

## 4. Docker Compose (optional)

Save this as `docker-compose.yml` in the project root:

```yaml
services:
  famitree:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - famitree-data:/app/data
    restart: unless-stopped
    environment:
      - PORT=3000
      - NODE_ENV=production

volumes:
  famitree-data:
```

Then run:

```bash
docker compose up -d
```

---

## 5. Deploy with Railway or Render (no server)

Easiest way to get FamiTree on the internet without managing a server: connect your Git repo, add a persistent volume for the database, and deploy.

### Railway

1. **Sign up** at [railway.app](https://railway.app) and create a new project.
2. **Connect your repo**: “Deploy from GitHub repo” → select the FamiTree repository.
3. **Build**: Railway will detect the `Dockerfile` and build the image. If it doesn’t, set **Build Command** to `docker build -t famitree .` or leave empty and ensure the Dockerfile is in the repo root.
4. **Start command**: Set **Start Command** to `node server.js` (or leave empty if the Dockerfile `CMD` is used).
5. **Port**: Set **PORT** in Variables to `3000`, or leave default; Railway usually auto-detects.
6. **Persistent volume** (important for the DB — without this, data is lost on every redeploy):
   - In your service → **Variables** / **Settings** → **Volumes** (or “Add volume”).
   - **Create a volume**: On the project canvas, press **⌘K** / **Ctrl+K** → type **volume** → **Create volume**. Or right-click the canvas → create volume.
   - When prompted, **select your FamiTree service** and set the **mount path** to **`/app/data`**.
7. **Deploy**: Push to your main branch or trigger a deploy. Railway will give you a URL like `https://your-app.up.railway.app`.

### Render

1. **Sign up** at [render.com](https://render.com) and go to **Dashboard** → **New** → **Web Service**.
2. **Connect your repo**: Link GitHub/GitLab and select the FamiTree repository.
3. **Environment**: Choose **Docker** (Render will use your `Dockerfile`).
4. **Instance**: Free or paid; free tier may spin down after inactivity.
5. **Persistent disk** (important for the DB):
   - In the web service → **Disks** → **Add Disk**.
   - Mount path: `/app/data`.
   - Size: 1 GB is enough to start.
6. **Deploy**: Click **Create Web Service**. Render builds and runs the container and gives you a URL like `https://famitree.onrender.com`.

### Checklist for both

- [ ] Repo connected (GitHub/GitLab).
- [ ] Build uses **Dockerfile** (Railway/Render detect it automatically in most cases).
- [ ] Start command is `node server.js` or left to Dockerfile `CMD`.
- [ ] **Persistent volume/disk** mounted at **`/app/data`** so the SQLite DB is kept.
- [ ] After first deploy, open the URL, register the admin user, and set a strong password.

---

## 6. Security checklist

- Use **HTTPS** (e.g. Let’s Encrypt) so traffic is encrypted.
- Set a **strong password** for the admin user after first login.
- Keep the server updated: `sudo apt update && sudo apt upgrade -y`.
- Restrict firewall to ports you need (e.g. 80, 443, 22): `ufw` or your provider’s firewall.
- Prefer running the app **behind a reverse proxy** (Nginx/Caddy) instead of exposing the container port directly to the internet.

---

## 7. Quick reference

| Task              | Command |
|-------------------|--------|
| Build image       | `docker build -t famitree .` |
| Run with DB       | `docker run -d -p 3000:3000 -v famitree-data:/app/data --restart unless-stopped famitree` |
| View logs         | `docker logs -f famitree` |
| Stop              | `docker stop famitree` |
| Start again       | `docker start famitree` |
| Remove container  | `docker rm -f famitree` (volume `famitree-data` keeps the DB) |

---

## 8. Other hosting options

- **Fly.io**: Deploy with `fly launch` and the Dockerfile; add a [volume](https://fly.io/docs/reference/volumes/) mounted at `/app/data` for the SQLite file.
- **Cloud Run (GCP)** or **App Platform (DigitalOcean)**: Deploy the container image and map port 3000; use a persistent volume or external storage for the SQLite file if you need to keep data across deploys.

For any platform, ensure the SQLite database path (`/app/data` in the container) is persisted so data is not lost on redeploy.
