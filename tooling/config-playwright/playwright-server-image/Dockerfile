# Installing Playwright with `npx` on every start took longer than the startup timeout, and longer
# still when several test runs started at once. This image installs it once per version; later runs
# reuse the local image and start in about a second.
ARG PLAYWRIGHT_VERSION
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble
ARG PLAYWRIGHT_VERSION
WORKDIR /opt/playwright-server
RUN npm install --no-audit --no-fund "playwright@${PLAYWRIGHT_VERSION}"
COPY serve.sh ./serve.sh
