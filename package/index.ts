export { authenticate } from './middleware'

import type { ValidationResult } from '@navikt/oasis'

/**
 * Extend `App.Locals` with the auth fields set by the middleware so that
 * consuming Astro apps get type safety without manual augmentation.
 *
 * `token` and `validation` are only present after the middleware has run,
 * i.e. on authenticated routes.
 */
declare global {
    namespace App {
        interface Locals {
            token: string
            validation: ValidationResult
        }
    }
}
