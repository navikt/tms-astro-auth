import { getToken, validateToken } from '@navikt/oasis'
import { defineMiddleware } from 'astro/middleware'
import type { MiddlewareHandler } from 'astro'

export interface AuthMiddlewareOptions {
    /**
     * Path of the OAuth2 login endpoint, managed by Wonderwall/Nais.
     * Defaults to '/oauth2/login'.
     */
    loginPath?: string

    /**
     * The URI to redirect back to after successful login.
     * Defaults to the current request URL (href).
     *
     * Can be a static string or a function that receives the middleware context
     * and returns a string — useful when the redirect target depends on the request.
     */
    redirectUri?: string | ((context: Parameters<MiddlewareHandler>[0]) => string)
}

export const createAuthMiddleware = (options: AuthMiddlewareOptions = {}): MiddlewareHandler => {
    const loginPath = options.loginPath ?? '/oauth2/login'

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

        const loginUrl = `${loginPath}?redirect=${encodeURIComponent(redirectUri)}`

        if (!token) {
            return context.redirect(loginUrl)
        }

        const validation = await validateToken(token)

        if (!validation.ok) {
            console.info('Validation of token failed. Redirecting to login')
            return context.redirect(loginUrl)
        }

        context.locals.token = token
        context.locals.isSubstantial = validation.payload.acr === 'idporten-loa-substantial'

        return next()
    })
}
