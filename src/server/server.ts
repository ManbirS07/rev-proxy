//for the master process
import express from 'express';
import { main } from '../index.js';
import { proxyRequestHandler } from './proxy_handler.js';
import { createBalancer } from './balancers/balancerFactory.js';
import { TokenBucketRateLimiter } from './middleware/rateLimiter.js';

//abhi I have a single node js process and no worker processes, so the master server is also handling the requests. In the future, when I implement clustering, the master process will only be responsible for managing worker processes and won't handle any requests directly.
//The workers will run their own instances of Express to handle incoming requests, while the master will manage load balancing and worker lifecycle.
export async function startServer(config: Awaited<ReturnType<typeof main>>) {
    const app = express();
    const port = config?.server.listen

    if (!port) {
        console.error('Master port not defined in config');
        process.exit(1);
    }

    const httpServer = app.listen(port, () => {
        console.log(`Master server is running on port ${port}`);
    })
    
    app.get('/ping', async (req, res) => {
        res.send('pong');
    })
    return {app, httpServer}; //app is just for routing, httpServer is for load balancing and worker management
}

export async function forwardRequesttoProxyHandler() {
    const config = await main(); 
    const {app, httpServer} = await startServer(config); //router for the master server

    const upstreams = config?.server.upstreams; //get the upstreams from the config file
    if (!upstreams) {
        console.error('Upstreams not defined in config');
        process.exit(1);
    }

    const endpoints = config?.server.endpoints; //get the endpoints from the config file
    if (!endpoints) {
        console.error('Endpoints not defined in config');
        process.exit(1);
    }

    //tracking TCP connections on the underlying http server
    let activeTcpConnections = 0;

    // Token Bucket Rate Limiting (applied to ALL requests before routing) 
    // This runs before any route handler, so rate-limited requests never reach upstreams.
    const rateLimitConfig = config?.server.rate_limit;
    if (rateLimitConfig?.enabled) {
        //creating a limiter object with the capacity and refill rate defined in the config file, then applying its middleware to the Express app so that it runs for every incoming request before any route handlers are executed. This ensures that all requests are subject to the token bucket rate limiting logic, regardless of which endpoint they hit.
        const limiter = new TokenBucketRateLimiter(rateLimitConfig.capacity, rateLimitConfig.refill_rate);
        app.use(limiter.middleware());
        console.log(`Token bucket rate limiter enabled: capacity=${rateLimitConfig.capacity}, refill_rate=${rateLimitConfig.refill_rate}/sec`);
    }

    httpServer.on('connection', (socket) => {
        activeTcpConnections++;
        console.log(`Client TCP connected from ${socket.remoteAddress ?? 'unknown'}:${socket.remotePort ?? 'unknown'} | active connections: ${activeTcpConnections}`);

        socket.on('close', () => {
            activeTcpConnections = Math.max(0, activeTcpConnections - 1);
            console.log(`Client TCP disconnected | active connections: ${activeTcpConnections}`);
        });
    });

    for(const endpoint of endpoints) {
        const balancer = createBalancer(endpoint.strategy, endpoint.upstreams); //created ONCE per endpoint, lives across all requests
        //endpoint.upstreams are the upstreams available for the current endpoint
        app.all(endpoint.path, async (req, res) => {
            //forward the request to the proxy handler
            await proxyRequestHandler(balancer, endpoint.strategy, req, res, upstreams); //the upstreams passed here are the global upstreams defined in the config file, which the proxy handler will match with the upstreamId returned by the balancer to get the url to forward to
        })
    }

    // 404 catch-all — must be registered after all other routes
    app.use((req, res) => {
        res.status(404).send(`Invalid Route: ${req.originalUrl}`);
    });
}
