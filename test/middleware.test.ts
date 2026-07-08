import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@navikt/oasis', () => ({
    getToken: vi.fn(),
    validateToken: vi.fn(),
}))

vi.mock('astro/middleware', () => ({
    defineMiddleware: (fn: unknown) => fn,
}))

import { getToken, validateToken } from '@navikt/oasis'
import { createAuthMiddleware } from '../package/middleware'

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

describe('createAuthMiddleware', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    afterEach(() => {
        delete process.env.NODE_ENV
    })

    it('skips auth in local development', async () => {
        process.env.NODE_ENV = 'development'
        const middleware = createAuthMiddleware()
        await middleware(createMockContext() as any, next)
        expect(next).toHaveBeenCalled()
    })

    it('skips auth for internal URLs', async () => {
        const middleware = createAuthMiddleware()
        await middleware(createMockContext('https://app.nav.no/internal/health') as any, next)
        expect(next).toHaveBeenCalled()
    })

    it('redirects to default login path when no token', async () => {
        vi.mocked(getToken).mockReturnValue(null)
        const context = createMockContext()
        const middleware = createAuthMiddleware()
        await middleware(context as any, next)
        expect(context.redirect).toHaveBeenCalledWith(expect.stringContaining('/oauth2/login?redirect='))
    })

    it('redirects to login when token is invalid', async () => {
        vi.mocked(getToken).mockReturnValue('invalid-token')
        vi.mocked(validateToken).mockResolvedValue({ ok: false, error: new Error('invalid') })
        const context = createMockContext()
        const middleware = createAuthMiddleware()
        await middleware(context as any, next)
        expect(context.redirect).toHaveBeenCalledWith(expect.stringContaining('/oauth2/login?redirect='))
    })

    it('sets token and isSubstantial=true on valid substantial token', async () => {
        vi.mocked(getToken).mockReturnValue('valid-token')
        vi.mocked(validateToken).mockResolvedValue({ ok: true, payload: { acr: 'idporten-loa-substantial' } })
        const context = createMockContext()
        const middleware = createAuthMiddleware()
        await middleware(context as any, next)
        expect(context.locals.token).toBe('valid-token')
        expect(context.locals.isSubstantial).toBe(true)
        expect(next).toHaveBeenCalled()
    })

    it('sets isSubstantial=false for non-substantial acr', async () => {
        vi.mocked(getToken).mockReturnValue('valid-token')
        vi.mocked(validateToken).mockResolvedValue({ ok: true, payload: { acr: 'idporten-loa-high' } })
        const context = createMockContext()
        const middleware = createAuthMiddleware()
        await middleware(context as any, next)
        expect(context.locals.isSubstantial).toBe(false)
    })

    it('uses custom loginPath', async () => {
        vi.mocked(getToken).mockReturnValue(null)
        const context = createMockContext()
        const middleware = createAuthMiddleware({ loginPath: '/minside/oauth2/login' })
        await middleware(context as any, next)
        expect(context.redirect).toHaveBeenCalledWith(expect.stringContaining('/minside/oauth2/login?redirect='))
    })

    it('uses custom redirectUri as string', async () => {
        vi.mocked(getToken).mockReturnValue(null)
        const context = createMockContext()
        const middleware = createAuthMiddleware({ redirectUri: 'https://app.nav.no' })
        await middleware(context as any, next)
        expect(context.redirect).toHaveBeenCalledWith(`/oauth2/login?redirect=${encodeURIComponent('https://app.nav.no')}`)
    })

    it('uses custom redirectUri as function', async () => {
        vi.mocked(getToken).mockReturnValue(null)
        const context = createMockContext('https://app.nav.no/page?foo=bar')
        const middleware = createAuthMiddleware({ redirectUri: (ctx) => ctx.url.origin })
        await middleware(context as any, next)
        expect(context.redirect).toHaveBeenCalledWith(`/oauth2/login?redirect=${encodeURIComponent('https://app.nav.no')}`)
    })

    it('encodes the current URL as redirect when no redirectUri is set', async () => {
        vi.mocked(getToken).mockReturnValue(null)
        const context = createMockContext('https://app.nav.no/page?foo=bar')
        const middleware = createAuthMiddleware()
        await middleware(context as any, next)
        expect(context.redirect).toHaveBeenCalledWith(
            `/oauth2/login?redirect=${encodeURIComponent('https://app.nav.no/page?foo=bar')}`,
        )
    })
})
