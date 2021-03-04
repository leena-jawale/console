/* Copyright Contributors to the Open Cluster Management project */

/* istanbul ignore file */
import * as Router from 'find-my-way'
import { Http2Server, Http2ServerRequest, Http2ServerResponse } from 'http2'
import { cors } from './lib/cors'
import { delay } from './lib/delay'
import { logger, stopLogger } from './lib/logger'
import { notFound, respondInternalServerError, respondOK } from './lib/respond'
import { startServer, stopServer } from './lib/server'
import { ServerSideEvents } from './lib/server-side-events'
import { header } from './routes/header'
import { login, loginCallback } from './routes/oauth'
import { proxy } from './routes/proxy'
import { search } from './routes/search'
import { serve } from './routes/serve'
import { upgrade } from './routes/upgrade'
import { watch } from './routes/watch'
import { startLoggingMemory } from './lib/memory'

export const router = Router<Router.HTTPVersion.V2>()
router.get(`/readinessProbe`, respondOK)
router.get(`/ping`, respondOK)
router.all(`/api/*`, proxy)
router.all(`/apis/*`, proxy)
router.get(`/login`, login)
router.get(`/login/callback?*`, loginCallback)
router.get(`/header`, header)
router.get(`/watch`, watch)
router.get(`/header/*`, header)
router.post(`/proxy/search`, search)
router.post(`/upgrade`, upgrade)
router.get(`/*`, serve)

async function requestHandler(req: Http2ServerRequest, res: Http2ServerResponse): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
        cors(req, res)
        await delay(req, res)
    }

    logger.info(req.url)

    if (req.url === '/multicloud') (req as any).url = '/'
    else if (req.url.startsWith('/multicloud')) (req as any).url = req.url.substr(11)

    res.sendDate = false

    const route = router.find(req.method as Router.HTTPMethod, req.url)
    if (!route) return notFound(req, res)

    try {
        const result: unknown = route.handler(req, res, route.params, route.store)
        if (result instanceof Promise) await result
    } catch (err) {
        logger.error(err)
        if (!res.headersSent) return respondInternalServerError(req, res)
    }
}

export function start(): Promise<Http2Server | undefined> {
    return startServer({ requestHandler })
}

export async function stop(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
        setTimeout(() => {
            process.exit(1)
        }, 0.5 * 1000).unref()
    }
    const stopServerPromise = stopServer()
    await ServerSideEvents.dispose()
    await stopServerPromise
    stopLogger()
}

if (process.env.NODE_ENV === 'development' || process.env.LOG_MEMORY === 'true') {
    startLoggingMemory()
}
