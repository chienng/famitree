build:
	npm install && npm run build

local:
	npm run build && npm run dev

dev:
	npm run build && npm start

tunnel:
	lt --port 3000
