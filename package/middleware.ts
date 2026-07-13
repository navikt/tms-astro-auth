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
        const base = import.meta.env.BASE_URL.replace(/\/$/, '')
        const loginUrl = `${base}/oauth2/login?redirect=${context.url.pathname}${encodeURIComponent(context.url.search)}`

        context.logger.info(`Authenticating request to ${context.url.pathname}${context.url.search}`)

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
