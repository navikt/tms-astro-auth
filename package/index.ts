export { createAuthMiddleware, type AuthMiddlewareOptions } from './middleware'

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
