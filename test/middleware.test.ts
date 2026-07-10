import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@navikt/oasis', () => ({
    getToken: vi.fn(),
    validateToken: vi.fn(),
}))

vi.mock('astro/middleware', () => ({
    defineMiddleware: (fn: unknown) => fn,
    sequence:
        (...handlers: ((ctx: unknown, next: () => Promise<Response>) => Promise<Response>)[]) =>
        (context: unknown, outerNext: () => Promise<Response>) => {
            const run = (index: number): Promise<Response> =>
                index >= handlers.length ? outerNext() : handlers[index](context, () => run(index + 1))
            return run(0)
        },
}))

import { getToken, validateToken } from '@navikt/oasis'
import { authenticate } from '../package/middleware'
import { sequence } from 'astro/middleware'

function createMockContext(url = 'https://app.nav.no/page') {
    const parsedUrl = new URL(url)
    return {
        request: new Request(url),
        url: parsedUrl,
        locals: {} as Record<string, unknown>,
        redirect: vi.fn((redirectUrl: string) => new Response(null, { status: 302, headers: { Location: redirectUrl } })),
    }
}

const next = vi.fn(() => Promise.resolve(new Response('ok')))

describe('authenticate', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    afterEach(() => {
        delete process.env.NODE_ENV
    })

    it('skips auth in local development', async () => {
        process.env.NODE_ENV = 'development'
        const middleware = authenticate()
        await middleware(createMockContext() as any, next)
        expect(next).toHaveBeenCalled()
    })

    it('skips auth for internal URLs', async () => {
        const middleware = authenticate()
        await middleware(createMockContext('https://app.nav.no/internal/health') as any, next)
        expect(next).toHaveBeenCalled()
    })

    it('redirects to /oauth2/login when no token', async () => {
        vi.mocked(getToken).mockReturnValue(null)
        const context = createMockContext()
        const middleware = authenticate()
        await middleware(context as any, next)
        expect(context.redirect).toHaveBeenCalledWith(expect.stringContaining('/oauth2/login?redirect='))
    })

    it('redirects to /oauth2/login when token is invalid', async () => {
        vi.mocked(getToken).mockReturnValue('invalid-token')
        vi.mocked(validateToken).mockResolvedValue({ ok: false, error: new Error('invalid') })
        const context = createMockContext()
        const middleware = authenticate()
        await middleware(context as any, next)
        expect(context.redirect).toHaveBeenCalledWith(expect.stringContaining('/oauth2/login?redirect='))
    })

    it('sets token on valid token', async () => {
        vi.mocked(getToken).mockReturnValue('valid-token')
        vi.mocked(validateToken).mockResolvedValue({ ok: true, payload: { acr: 'idporten-loa-substantial' } })
        const context = createMockContext()
        const middleware = authenticate()
        await middleware(context as any, next)
        expect(context.locals.token).toBe('valid-token')
        expect(next).toHaveBeenCalled()
    })

    it('uses custom redirectUri as string', async () => {
        vi.mocked(getToken).mockReturnValue(null)
        const context = createMockContext()
        const middleware = authenticate({ redirectUri: 'https://app.nav.no' })
        await middleware(context as any, next)
        expect(context.redirect).toHaveBeenCalledWith(`/oauth2/login?redirect=${encodeURIComponent('https://app.nav.no')}`)
    })

    it('uses custom redirectUri as function', async () => {
        vi.mocked(getToken).mockReturnValue(null)
        const context = createMockContext('https://app.nav.no/page?foo=bar')
        const middleware = authenticate({ redirectUri: (ctx) => ctx.url.origin })
        await middleware(context as any, next)
        expect(context.redirect).toHaveBeenCalledWith(`/oauth2/login?redirect=${encodeURIComponent('https://app.nav.no')}`)
    })

    it('encodes the current URL as redirect when no redirectUri is set', async () => {
        vi.mocked(getToken).mockReturnValue(null)
        const context = createMockContext('https://app.nav.no/page?foo=bar')
        const middleware = authenticate()
        await middleware(context as any, next)
        expect(context.redirect).toHaveBeenCalledWith(
            `/oauth2/login?redirect=${encodeURIComponent('https://app.nav.no/page?foo=bar')}`,
        )
    })
})

describe('sequence with authenticate', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    afterEach(() => {
        delete process.env.NODE_ENV
    })

    it('runs auth then the provided middleware on a valid token', async () => {
        vi.mocked(getToken).mockReturnValue('valid-token')
        vi.mocked(validateToken).mockResolvedValue({ ok: true, payload: { acr: 'idporten-loa-substantial' } })

        let tokenSeenByApp: unknown
        const appMiddleware = vi.fn((ctx: typeof context, next: () => Promise<Response>) => {
            tokenSeenByApp = ctx.locals.token
            return next()
        })
        const handler = sequence(authenticate(), appMiddleware as any)
        const context = createMockContext()

        await handler(context as any, next)

        expect(tokenSeenByApp).toBe('valid-token')
        expect(appMiddleware).toHaveBeenCalled()
        expect(next).toHaveBeenCalled()
    })

    it('stops at auth and does not run app middleware when token is missing', async () => {
        vi.mocked(getToken).mockReturnValue(null)

        const appMiddleware = vi.fn()
        const handler = sequence(authenticate(), appMiddleware as any)
        const context = createMockContext()

        await handler(context as any, next)

        expect(context.redirect).toHaveBeenCalledWith(expect.stringContaining('/oauth2/login'))
        expect(appMiddleware).not.toHaveBeenCalled()
    })
})
