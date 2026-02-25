import type { Endpoint } from "../../types/endpoints.js";
const {createHash} = await import('crypto');

class IpHashBalancer {
    private availableUpstreams: Endpoint['upstreams'];
    
    constructor(availableUpstreams: Endpoint['upstreams']) {
        this.availableUpstreams = availableUpstreams;
    }
    
    getNextUpstream(req: any) {
        const ip = req.ip || req.connection.remoteAddress || '';
        const hash = createHash('sha256')
        hash.update(ip); //update the hash with the client's IP address

        const digest = hash.digest('hex'); //get the hash digest as a hexadecimal string
        const index = parseInt(digest.substring(0, 8), 16) % this.availableUpstreams.length; //use the first 8 characters of the hash to determine the index of the upstream server. This ensures that the same IP will consistently map to the same upstream as long as the number of upstreams doesn't change.
        return this.availableUpstreams[index];
    }

    onRequestStart(upstream: string) {
        //ip-hash doesn't care about the number of active connections,
        return () => {};
    }
}

export default IpHashBalancer;