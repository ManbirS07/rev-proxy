import type { Endpoint } from "../../types/endpoints.js";
import { globalRequestMap } from "../proxy_handler.js";

class leastConnectionsBalancer {
    private availableUpstreams: Endpoint['upstreams'];
    
    constructor(availableUpstreams: Endpoint['upstreams']) {
        this.availableUpstreams = availableUpstreams;
        // Initialize all upstreams in the global map with 0 active requests
        for (const upstreamId of availableUpstreams) {
            if (!globalRequestMap.has(upstreamId)) {
                globalRequestMap.set(upstreamId, 0);
            }
        }
    }

    getNextUpstream(req?: any) {
        // Find the upstream with the least active requests
        let leastLoadedUpstream: string | null = null;
        let minConnections = Infinity;

        for(const upstream of this.availableUpstreams) {
            const activeConnections = globalRequestMap.get(upstream) //current active request count for this upstream

            if(activeConnections !== undefined && activeConnections < minConnections) {
                minConnections = activeConnections;
                leastLoadedUpstream = upstream;
            }
        }

        // Atomically increment the count right here so that the next
        // concurrent call already sees this upstream's count as +1.
        // Without this, two requests arriving at the same tick both
        // read count=0 and both pick the same upstream.
        if (leastLoadedUpstream) {
            const current = globalRequestMap.get(leastLoadedUpstream) ?? 0;
            globalRequestMap.set(leastLoadedUpstream, current + 1);
        }

        return leastLoadedUpstream;
    }

    onRequestStart(upstreamId: string) {
        // Return a release function to decrement the count when the request is done
        let hasReleased = false

        const release = () => {
            if(!hasReleased) {
                const currentCount = globalRequestMap.get(upstreamId)
                if (currentCount !== undefined) {
                    globalRequestMap.set(upstreamId, Math.max(0, currentCount - 1))
                }
                hasReleased = true;
            }
        }

        return release;
    }


}

export default leastConnectionsBalancer;