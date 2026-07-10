# @navikt/astro-auth

Astro middleware for authentication i Nav-applikasjoner via [Wonderwall/Nais](https://doc.nais.io/security/auth/wonderwall/).

Den validerer JWT-tokens fra Wonderwall med [`@navikt/oasis`](https://github.com/navikt/oasis), omdirigerer til innlogging ved manglende eller ugyldig token, og setter `token` på `context.locals` for autentiserte forespørsler.

## Installasjon

```bash
pnpm i @navikt/astro-auth
```

`astro` er en peer-avhengighet.

## Bruk

### Steg 1: Registrer mellomvaresekvensen

Opprett `src/middleware.ts` i Astro-prosjektet ditt. Bruk `sequence` for å kombinere autentisering med appens egen mellomvarelogikk:

```ts
import { authenticate } from '@navikt/astro-auth'
import { sequence } from 'astro/middleware'

export const onRequest = sequence(
    authenticate(),
    async (context, next) => {
        // din applikasjonsspesifikke mellomvarelogikk her
        return next()
    },
)
```

Autentiseringen kjøres alltid først mot `/oauth2/login`. Appens mellomvare kjøres kun etter et gyldig token.

Som standard brukes gjeldende URL som `redirect`-parameter etter innlogging. Du kan overstyre dette med `redirectUri`:

```ts
// Statisk URI — brukeren sendes alltid hit etter innlogging
export const onRequest = sequence(
    authenticate({ redirectUri: 'https://www.nav.no/minside' }),
    async (context, next) => {
        return next()
    },
)

// Dynamisk URI — avhengig av forespørselen
export const onRequest = sequence(
    authenticate({ redirectUri: (context) => context.url.origin }),
    async (context, next) => {
        return next()
    },
)
```

### Steg 2: Bruk token i komponenter og endepunkter

```astro
---
// src/pages/index.astro
const { token } = Astro.locals
---
```

```ts
// src/pages/api/data.ts
import type { APIContext } from 'astro'

export function GET({ locals }: APIContext) {
    const { token } = locals
    // ...
}
```

## Oppførsel

| Forespørsel | Resultat |
| --- | --- |
| `NODE_ENV === 'development'` | Hopper over autentisering (lokal utvikling) |
| URL inneholder `/internal` | Hopper over autentisering (interne Nais-endepunkter) |
| Manglende token | Omdirigerer til `/oauth2/login?redirect=<redirectUri>` |
| Ugyldig token | Omdirigerer til `/oauth2/login?redirect=<redirectUri>` |
| Gyldig token | Setter `locals.token`, fortsetter |

## API

### `authenticate(options?)`

Returnerer en `MiddlewareHandler` som validerer tokenet og setter `locals.token`.

### `Options`

| Opsjon | Type | Standard | Beskrivelse |
| --- | --- | --- | --- |
| `redirectUri` | `string \| (context) => string` | Gjeldende forespørsels-URL | URI som sendes som `redirect`-parameter etter innlogging. |

### `App.Locals`

Pakken utvider `App.Locals` automatisk med følgende felter:

| Felt | Type | Beskrivelse |
| --- | --- | --- |
| `token` | `string` | Rå JWT-token fra forespørselen. |

## Lisens

MIT