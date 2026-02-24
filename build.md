```bash
# Build image
docker build -t famitree-1.0 .

# Run (DB is lost when container is removed)
docker run -p 3000:3000 famitree-1.0

# Run with persistent DB (recommended for deploy)
docker run -p 3000:3000 -v famitree-data:/app/data famitree-1.0
```

Then open http://localhost:3000 (or your host’s IP/domain). To change the port:
  
```bash
docker run -p 8080:8080 -e PORT=8080 -v famitree-data:/app/data famitree-1.0
```
