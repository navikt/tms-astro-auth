import { sequence } from 'astro/middleware'
import type { MiddlewareHandler } from 'astro'
import { createAuthMiddleware } from './middleware'
import type { AuthMiddlewareOptions } from './middleware'

export { createAuthMiddleware, type AuthMiddlewareOptions } from './middleware'
export { sequence } from 'astro/middleware'

/**
 * Creates an Astro middleware sequence with auth as the first handler,
 * followed by any additional middleware the app provides.
 *
 * ```ts
 * // src/middleware.ts
 * import { createAuthSequence } from '@navikt/astro-auth'
 *
 * export const onRequest = createAuthSequence(
 *     { loginPath: '/minside/oauth2/login' },
 *     async (context, next) => {
 *         // your app-specific middleware logic
 *         return next()
 *     },
 * )
 * ```
 *
 * If you need full control, compose manually using the re-exported `sequence`:
 *
 * ```ts
 * import { createAuthMiddleware, sequence } from '@navikt/astro-auth'
 *
 * export const onRequest = sequence(
 *     createAuthMiddleware(),
 *     myMiddleware,
 * )
 * ```
 */
export const createAuthSequence = (
    options: AuthMiddlewareOptions,
    ...middlewares: MiddlewareHandler[]
): MiddlewareHandler => sequence(createAuthMiddleware(options), ...middlewares)

/**
 * Extend `App.Locals` with the auth fields set by the middleware so that
 * consuming Astro apps get type safety without manual augmentation.
 *
 * `token` and `isSubstantial` are only present after the middleware has
 * run, i.e. on authenticated routes.
 */
declare global {
    namespace App {
        interface Locals {
            /** The raw JWT token extracted from the incoming request. */
            token: string
            /**
             * Whether the token carries 'substantial' level of assurance
             * (`idporten-loa-substantial`). `false` for lower (or unknown) levels.
             */
            isSubstantial: boolean
        }
    }
}
