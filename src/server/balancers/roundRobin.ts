import type { Endpoint } from "../../types/endpoints.js";

class RoundRobinBalancer{
    private roundRobinIndex: number;
    private availableUpstreams: Endpoint['upstreams'];

    constructor(availableUpstreams: Endpoint['upstreams']) {
        this.roundRobinIndex = 0;
        this.availableUpstreams = availableUpstreams;
    }

    getNextUpstream(_req?: any) {
        const upstreamId = this.availableUpstreams[this.roundRobinIndex];
        const noOfUpstreams = this.availableUpstreams.length;
        // Update the index for the next request
        this.roundRobinIndex = (this.roundRobinIndex + 1) % noOfUpstreams;
        return upstreamId;
    }

    onRequestStart(_upstream: string) {
        //round robin doesn't care about the number of active connections,
        //so release is a no-op. We return a dummy function to maintain
        //a consistent interface with the other balancers.
        return () => {};
    }
}

export default RoundRobinBalancer;
//on calling onRequestStart
// The active request counter for upstream goes up by 1 (because a request just started)
// It returns a function (the release function) that you'll call later to bring the counter back down by 1
//release is a closure which has a flag 

// Why the hasReleased guard? Imagine the fetch throws, 
// the finally block calls release(), but then some error handler also
// accidentally calls it — without the guard, the counter would go negative,
// and least-connections would think that upstream has -1 requests (always picking it).
//  The guard makes release() idempotent — safe to call multiple times.