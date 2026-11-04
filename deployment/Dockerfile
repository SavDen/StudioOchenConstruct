FROM node:24-alpine
WORKDIR /app
COPY dist/ dist/
COPY library/manifest.json library/palettes.json library/
COPY library/vision/ library/vision/
COPY prompts/ prompts/
COPY scripts/serve.mjs scripts/visual_catalog.mjs scripts/gateway-policy.mjs scripts/
USER node
ENV HOST=0.0.0.0 PORT=8000 NODE_ENV=production AI_API_ONLY=1
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:8000/api/ai-status').then(r=>r.json()).then(s=>process.exit(s.configured&&s.vision?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/serve.mjs"]
