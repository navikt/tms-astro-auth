import { getToken, validateToken } from '@navikt/oasis'
import { defineMiddleware } from 'astro/middleware'
import type { MiddlewareHandler } from 'astro'

export interface AuthMiddlewareOptions {
    /**
     * The URI to redirect back to after successful login.
     * Defaults to the current request URL (href).
     *
     * Can be a static string or a function that receives the middleware context
     * and returns a string — useful when the redirect target depends on the request.
     */
    redirectUri?: string | ((context: Parameters<MiddlewareHandler>[0]) => string)
}

export const authenticate = (options: AuthMiddlewareOptions = {}): MiddlewareHandler => {
    return defineMiddleware(async (context, next) => {
        if (process.env.NODE_ENV === 'development') {
            return next()
        }

        if (context.request.url.includes('/internal')) {
            return next()
        }

        const token = getToken(context.request.headers)

        const redirectUri =
            typeof options.redirectUri === 'function'
                ? options.redirectUri(context)
                : options.redirectUri ?? context.url.href

        const loginUrl = `/oauth2/login?redirect=${encodeURIComponent(redirectUri)}`

        if (!token) {
            return context.redirect(loginUrl)
        }

        const validation = await validateToken(token)

        if (!validation.ok) {
            console.info('Validation of token failed. Redirecting to login')
            return context.redirect(loginUrl)
        }

        context.locals.token = token

        return next()
    })
}
