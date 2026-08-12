import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { Events } from "./domain.ts";

// lazy cache for events (loaded on first GET /events)
let cachedEvents: Events[] | null = null;

const server = createServer(async (req, res) => {
  // Route 1: GET /health
  if(req.method === "GET" && req.url === "/health") {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify({status: "ok", uptime: process.uptime()}));
    return;
  }

  // Route 2: GET /events
  if(req.method === "GET" && req.url === "/events") {
    // load lazily on first request
    if (!cachedEvents) {
      try {
        const file = await readFile("data/events.json", "utf-8");
        cachedEvents = JSON.parse(file) as Events[];
      } catch (err) {
        console.error("Failed to read data/events.json:", err);
        res.writeHead(500, {"Content-Type": "application/json"});
        res.end(JSON.stringify({error: "Internal Server Error"}));
        return;
      }
    }

    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify(cachedEvents));
    return;
  }

  // Not Found:  for any other route, return 404
  res.writeHead(404, {"Content-Type": "application/json"});
  res.end(JSON.stringify({error: "Not Found"}));
});

server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000/health");
});