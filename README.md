# FamiTree – Family Tree Manager

A web app to manage your family tree: add people, set parent–child and spouse relationships, and view the tree or a list of all members. Data is stored in your browser (localStorage).

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

## Deploy to the internet

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for how to run FamiTree with Docker and deploy it to a server with HTTPS.

## Features

- **Add / edit / delete** family members (name, birth/death dates, gender, notes).
- **Relationships**: assign parents, children, and spouse from existing people.
- **Tree view**: hierarchical view with couples and children.
- **List view**: grid of all members; click to edit.
- **Persistence**: data is saved in `localStorage` and survives refresh.

## Tech

- React 18 + TypeScript
- Vite
- No backend; state and localStorage only
