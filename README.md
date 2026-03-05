# Clothes Sales Tracker

A mobile-first web app to track expenses and revenues from clothes sales. Data is stored in a JSON file on the server.

## Features

- **Add entries**: Clothes name, bought price, optional sell price (when sold)
- **List all clothes**: Grouped by month with dates
- **Monthly statistics**: Spent, sold, and profit per month
- **Mark as sold**: Add sell price to existing entries
- **Delete** entries

## Run locally

### 1. Backend (API + file storage)

```bash
cd server
npm install
npm run dev
```

Server runs at `http://localhost:3001`. Data is stored in `server/data/entries.json`.  
**Note:** In dev, opening `http://localhost:3001` in the browser only shows a short info page. Use the frontend URL below to run the app.

### 2. Frontend

```bash
cd client
npm install
npm run dev
```

**Open the URL shown by Vite** (e.g. `http://localhost:5173`) – that’s where the app runs. The dev server proxies `/api` to the backend.

### 3. Use on your phone

- Ensure phone and computer are on the same Wi‑Fi.
- Find your computer’s local IP (e.g. `192.168.1.10`).
- On the machine running Vite, start the dev server with host:  
  `npm run dev -- --host`
- On your phone, open `http://<your-ip>:5173`.
- Backend must be reachable: either run it on the same machine and use `<your-ip>:3001` for API, or set the client’s `VITE_API_URL` and configure the backend to allow CORS from that origin.

For production, build the client (`npm run build` in `client`), serve the built files, and point the app to your backend URL.

## Docker

### Run locally with Docker

```bash
docker compose up -d --build
```

App is at `http://localhost:3001`.

**Data on your local storage**

The app’s data (e.g. `entries.json`) is stored in a **bind volume** so it lives on your machine:

- **Path:** `./data` in the project directory (relative to where you run `docker compose`).
- On first run, the `data` folder is created if it doesn’t exist. All app data is written there, so you can back it up, move it, or point the volume to another path.

To use a different folder on your machine, edit `docker-compose.yml` and change the volume:

```yaml
volumes:
  - /your/own/path:/app/data
```

If you see a Docker API version error (client too new for daemon), set:

```bash
export DOCKER_API_VERSION=1.43
```

then run `docker compose up -d --build` again.

### Build image and run on another machine

**1. On this machine – build and save the image**

```bash
cd clothes-sales-tracker
docker build -t clothes-sales-tracker:latest .
docker save clothes-sales-tracker:latest -o clothes-sales-tracker.tar
```

**2. Copy the image to the other machine**

```bash
scp clothes-sales-tracker.tar USER@OTHER_MACHINE_IP:/path/on/other/machine/
```

Replace `USER`, `OTHER_MACHINE_IP`, and `/path/on/other/machine/` with your username, the other machine’s IP (or hostname), and the directory where you want the file.

**3. On the other machine – load and run**

To keep data on that machine’s disk, use a bind mount (replace `/home/you/clothes-data` with your path):

```bash
docker load -i clothes-sales-tracker.tar
mkdir -p /home/admin/webhome/volumes/clothes-sales-tracker
docker run -d \
  --name clothes-tracker \
  -p 3001:3001 \
  -v /home/admin/webhome/volumes/clothes-sales-tracker:/app/data \
  --restart unless-stopped \
  clothes-sales-tracker:latest
```

Then open `http://<other-machine-ip>:3001` in a browser.

**Optional: use docker-compose on the other machine**

Copy the compose file as well:

```bash
scp docker-compose.yml USER@OTHER_MACHINE_IP:/path/on/other/machine/
```

On the other machine, in the same directory as `docker-compose.yml` and the `.tar` file:

```bash
docker load -i clothes-sales-tracker.tar
docker compose up -d
```

Data will be stored in `./data` there (or change the volume path in `docker-compose.yml` as above).

## Tech

- **Backend**: Node.js, Express, JSON file storage
- **Frontend**: React, TypeScript, Vite, Framer Motion (animations)
- **UI**: Mobile-first, bottom navigation, simple forms and list
