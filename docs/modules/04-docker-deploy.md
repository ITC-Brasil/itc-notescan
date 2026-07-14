# Módulo 4 — Docker e Deploy

**Data de conclusão:** 2026-06-26

---

## O que foi implementado

### Dockerfile multi-stage

```
Stage 1: deps     → instala node_modules com npm ci
Stage 2: builder  → gera o build Next.js standalone
Stage 3: runner   → imagem final de runtime
```

**Stage deps:**
- Imagem base: `node:20-alpine`
- `npm ci` para instalação determinística

**Stage builder:**
- Copia `node_modules` do deps
- Roda `npx prisma generate` (gera `src/generated/`)
- Roda `npm run build` com `NEXT_TELEMETRY_DISABLED=1`

**Stage runner:**
- Copia `standalone/` do builder
- Copia `public/` e `.next/static/`
- Copia `src/generated/` (cliente Prisma gerado)
- Copia `node_modules` completo do deps (necessário para `effect` e dependências do Prisma 7)
- Copia `prisma/` e `prisma.config.ts`
- Copia `scripts/docker-entrypoint.sh`
- Expõe porta 3000, roda como usuário não-root

### docker-compose.yml de produção

```yaml
services:
  notescan-app:
    build: .
    ports: ["3010:3000"]
    environment:
      DATABASE_URL: postgresql://notescan:...@notescan-db:5432/notescan
      # + NEXTAUTH_SECRET, TELEGRAM_*, VAPID_*, SENTRY_*
    depends_on: [notescan-db]

  notescan-db:
    image: postgres:16-alpine
    volumes: [notescan_db_data:/var/lib/postgresql/data]
    # porta não exposta ao host
```

### Entrypoint e migrations

`scripts/docker-entrypoint.sh`:
```bash
node node_modules/prisma/build/index.js migrate deploy
exec node server.js
```

Prisma chamado via `node node_modules/prisma/build/index.js` em vez de
`npx prisma` — o output standalone não copia os symlinks de `.bin/`.
Migrations aplicadas automaticamente a cada deploy.

### Cloudflare Tunnel

Tráfego externo via `itcbr-tunnel` sem exposição direta de porta:
```yaml
# ~/.cloudflared/config.yml
- hostname: notescan.itcbr.xyz
  service: http://localhost:3010
```

### Deploy manual

```bash
ssh glpissh@100.68.161.44  # ou glpi.grupoitcbrasil.com.br -p 2222
sudo chown -R glpissh:glpissh /home/glpissh/docker/notescan
cd ~/docker/notescan
git pull origin main
docker compose down
docker compose up -d --build
```

### CD automático (pendente)

`.github/workflows/deploy.yml` configurado mas aguarda configuração de secrets:
- `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`
- Acesso externo via porta 2222

---

## Verificação executada

- Build Docker local: `docker build -t notescan .` sem erros
- Container sobe e responde em `localhost:3010`
- Migrations aplicadas automaticamente no entrypoint
- Acesso via `notescan.itcbr.xyz` funcionando (Cloudflare Tunnel)
- Login e operações CRUD validados em produção

---

## Problemas encontrados e resolvidos

| Problema | Causa | Solução |
|---|---|---|
| `sh: prisma: not found` | Standalone não copia `.bin/` symlinks | `node node_modules/prisma/build/index.js` no entrypoint |
| `Cannot find module 'effect'` | Dependência transitiva do `@prisma/config` não incluída | Copiar `node_modules` completo do estágio deps |
| `datasource.url property is required` | `prisma.config.ts` ausente no runner | `COPY prisma.config.ts ./` no Dockerfile |
| `UntrustedHost` no NextAuth | Produção não listada nos hosts confiáveis | `trustHost: true` em `lib/auth/config.ts` |
| `git pull: Permission denied` | Ownership mudou para `github-deploy` | Reverter com `chown -R glpissh:glpissh` antes do pull |
| Prisma client não encontrado | Caminho do gerado mudou no Prisma 7 (`src/generated/` em vez de `node_modules/.prisma/`) | `COPY --from=builder src/generated ./src/generated` |

---

## Pontos de atenção

- O `node_modules` completo no runner aumenta o tamanho da imagem (~800MB) — trade-off aceito
- `prisma.config.ts` deve estar sempre na raiz — é lido pelo CLI do Prisma, não pelo Next.js
- O CD via GitHub Actions está configurado mas não operacional; usar deploy manual enquanto isso
- SSH externo usa porta 2222 (não padrão 22)
- O usuário `github-deploy` está criado no servidor mas a chave SSH ainda precisa ser adicionada aos secrets do GitHub

---

## Commits

```
4abea97 ci: add Dockerfile and CD deploy workflow for GLPI-SRV
6130c38 fix: correct Prisma 7 client path in Dockerfile
325aff1 fix: use node path for prisma in entrypoint instead of npx
3ce5dfe fix: copy prisma CLI deps from deps stage to include effect
a709ab3 fix: copy full node_modules from deps stage to runner
213c066 fix: copy prisma.config.ts to runner stage
c3a7b2e ci: set SSH port 2222 for GLPI-SRV deployment
680a57d fix: add trustHost to NextAuth config for Cloudflare Tunnel
7dee603 docs: update deploy section with Docker and GLPI-SRV details
```
