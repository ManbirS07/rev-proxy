import {z} from 'zod';

//object ka alag schema banega
const upstreamSchema = z.object({
    id: z.string(),
    url: z.url()
})

const headerSchema = z.object({
    key: z.string(),
    value: z.string()
})

const endpointSchema = z.object({
    path: z.string(),
    strategy: z.enum(['round-robin', 'least-connections', 'ip-hash']).default('round-robin'),
    upstreams: z.array(z.string()) //array of upstream ids, we will match these ids with the upstreams defined in the config file and then forward the request to the corresponding upstream url
})

// Token Bucket rate limiter config
// capacity = max tokens the bucket holds (burst size)
// refill_rate = tokens added per second (sustained request rate)
const rateLimitSchema = z.object({
    enabled: z.boolean().default(false),
    capacity: z.number().default(10),       // bucket size / burst allowance
    refill_rate: z.number().default(2),     // tokens added per second
})

const serverSchema = z.object({
    listen: z.number(),
    workers: z.number().optional().default(1),
    upstreams: z.array(upstreamSchema),
    headers: z.array(headerSchema).optional(),
    endpoints: z.array(endpointSchema),
    rate_limit: rateLimitSchema.optional(),
})

const rootConfigSchema = z.object({
    server: serverSchema
})

export default rootConfigSchema;