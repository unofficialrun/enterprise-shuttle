# Enterprise

Enterprise is an implementation of the @farcasterxyz/shuttle package.

The goal of this project is to provide an easy-to-deploy microservice that can backfill or stream messages from Farcaster hubs to a remote Postgres instance.

# Chris's contributions

- Refactored into a NestJS application.
- Dockerfile for easy deployment.
- Injection of the Kysley database instance across the application.

# See also

- <https://github.com/stephancill/farcaster-shuttle>
- <https://github.com/farcasterxyz/hub-monorepo/tree/main/packages/shuttle>
