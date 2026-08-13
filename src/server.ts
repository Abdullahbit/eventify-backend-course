import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findById, type Event } from './domain.ts';

const PORT = process.env.PORT || 3000;
const DATA_FILE_PATH = join(process.cwd(), 'data', 'events.json');

// Memory cache for lazy loading the events
let cachedEvents: Event[] | null = null;

/**
 * Helper function to load events asynchronously.
 * It reads the JSON file on the first request and caches the result.
 */
async function getEvents(): Promise<Event[]> {
    if (cachedEvents !== null) {
        return cachedEvents;
    }

    try {
        const fileContent = await readFile(DATA_FILE_PATH, 'utf-8');
        cachedEvents = JSON.parse(fileContent) as Event[];
        return cachedEvents;
    } catch (error) {
        console.error('Error reading events data file:', error);
        throw new Error('Database read failure');
    }
}

// Create the server
const server = createServer(async (req, res) => {
    const url = req.url || '';
    const method = req.method || 'GET';

    // 1. Route: GET /health
    if (method === 'GET' && url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
        return;
    }

    // 2. Route: GET /events
    if (method === 'GET' && url === '/events') {
        try {
            const events = await getEvents();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(events));
        } catch {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
        return;
    }

    // 3. Route: GET /events/:id
    // Matches URLs like /events/evt-1
    if (method === 'GET' && url.startsWith('/events/')) {
        const urlParts = url.split('/');
        const eventId = urlParts[2]; // Extracts the part after /events/

        // Ensure there is an ID and no trailing empty slashes
        if (eventId && urlParts.length === 3) {
            try {
                const events = await getEvents();
                const event = findById(events, eventId);

                if (event) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(event));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Event not found' }));
                }
            } catch {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal Server Error' }));
            }
            return;
        }
    }

    // 4. Fallback for all other unmatched routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
});
