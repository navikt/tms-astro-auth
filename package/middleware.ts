import { getToken, validateToken } from '@navikt/oasis'
import { defineMiddleware } from 'astro/middleware'
import type { MiddlewareHandler } from 'astro'

export const authenticate = (): MiddlewareHandler => {
    return defineMiddleware(async (context, next) => {
        if (process.env.NODE_ENV === 'development') {
            return next()
        }

        if (context.request.url.includes('/internal')) {
            return next()
        }

        const token = getToken(context.request.headers)
        const params = encodeURIComponent(context.url.search)
        const loginUrl = `/oauth2/login?redirect=${context.url.pathname}${params}`

        if (!token) {
            return context.redirect(loginUrl)
        }

        const validation = await validateToken(token)

        if (!validation.ok) {
            context.logger.info('Validation of token failed. Redirecting to login')
            return context.redirect(loginUrl)
        }

        context.locals.token = token

        return next()
    })
}
