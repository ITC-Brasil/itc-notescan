# Módulo 6 — CI/CD

**Data de conclusão:** 2026-06-26

---

## O que foi implementado

### `.github/workflows/ci.yml` — Quality Check

Roda em todo push e PR para qualquer branch.

**Etapas em sequência:**

1. **type-check** — `npx tsc --noEmit`
2. **lint** — `npx eslint src/`
3. **test** — `npm run test` (Vitest unitários, banco `notescan_test` via service PostgreSQL)
4. **audit** — `npm audit --audit-level=high`

**Service PostgreSQL no CI:**
```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: notescan
      POSTGRES_DB: notescan_test
      POSTGRES_PASSWORD: test
    ports: ["5432:5432"]
```

**Secrets/env necessários no CI:**
- `DATABASE_URL` apontando para o service (`postgresql://notescan:test@localhost:5432/notescan_test`)
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- `SENTRY_AUTH_TOKEN` (opcional para CI)

### `.github/workflows/deploy.yml` — CD Deploy

Roda no push para `main`. Um único passo SSH (sem `actions/checkout`: o código
é atualizado no próprio servidor):

```yaml
concurrency: { group: deploy-production, cancel-in-progress: false }
steps:
  - appleboy/ssh-action@0ff4204d59e8e51228ff73bce53f80d53301dee2 # v1.2.5
    # host, port, username, key e fingerprint vindos de secrets
    script:
      git pull --ff-only origin main
      docker compose up -d --build
      docker image prune -f --filter "label=com.itc.project=notescan"
```

**Endurecimento (ci/harden-deploy, 25/11/2026):**
- `concurrency`: deploys enfileiram e nunca cancelam um em andamento.
- Ação fixada pelo SHA do commit da v1.2.5 (release de 28/01/2026, cumpre a regra
  dos 14 dias). SHA conferido com `gh api repos/appleboy/ssh-action/git/ref/tags/v1.2.5`.
  Para atualizar: escolher release com 14+ dias, conferir o SHA da mesma forma e
  trocar SHA e comentário juntos.
- `fingerprint`: verifica a chave do host (proteção contra MITM). Formato
  `SHA256:<base64>`. Sucesso é silencioso no log; divergência aborta antes do
  script com `ssh: host key fingerprint mismatch`.
  - **Tipo de chave:** o `DEPLOY_HOST_FINGERPRINT` é o SHA256 da chave **ECDSA** do
    servidor, não a ed25519: o `x/crypto/ssh` (usado pela ação) prefere ECDSA
    quando o servidor oferece as duas. Obtido com:
    `ssh-keyscan -p 2222 -t ecdsa <host> | ssh-keygen -lf - -E sha256`
  - Se as host keys do servidor forem regeneradas, o secret precisa ser atualizado.
- Porta via secret `DEPLOY_PORT` em vez de `2222` fixo.
- `git pull --ff-only`: checkout divergente no servidor faz o deploy falhar em vez
  de criar merge local.
- Prune restrito ao label `com.itc.project=notescan` (PR #51), definido no estágio
  final do Dockerfile.

**Secrets necessários:**
- `DEPLOY_HOST`: hostname do servidor
- `DEPLOY_PORT`: porta SSH
- `DEPLOY_USER`: `github-deploy`
- `DEPLOY_SSH_KEY`: chave privada ed25519
- `DEPLOY_HOST_FINGERPRINT`: fingerprint SHA256 da chave do host

---

## Problemas encontrados e resolvidos

| Problema | Causa | Solução |
|---|---|---|
| Playwright specs rodando no Vitest | Vitest sem `include` explícito pegava `__tests__/e2e/` | `include: ['__tests__/unit/**']` no `vitest.config.ts` |
| 24 erros ESLint bloqueando lint | Regras `@typescript-eslint` e `eslint-plugin-security` com warnings tratados como erros | Corrigidos individualmente: tipos explícitos, regras de segurança |
| Shadcn components ausentes | `input-group` não instalado, bloqueava type-check | `npx shadcn@latest add input-group` + commit |
| CodeQL removido | GitHub CodeQL Action falhou com Next.js 16 (incompatibilidade) | Job removido do workflow; Semgrep pode ser adicionado futuramente |

---

## Status atual

| Workflow | Status |
|---|---|
| Quality Check (type-check, lint, test, audit) | ✅ Passando |
| Deploy automático via SSH | ✅ Operacional desde 28/10; endurecido em 25/11 |

---

## Pontos de atenção

- `npm audit` com `--audit-level=high`: vulnerabilidades críticas e altas bloqueiam o CI
- Se adicionar dependência com vulnerabilidade conhecida, avaliar se tem fix disponível antes de aceitar
- A porta SSH de deploy é não padrão (secret `DEPLOY_PORT`) — garantir que o runner do GitHub Actions permite conexões de saída nessa porta

---

## Commits

```
db9d2bb ci: add GitHub Actions CI pipeline with type-check, lint, tests and CodeQL
6c07ce5 ci: fix pipeline order and commit missing shadcn components
215dc17 ci: add missing input-group component and remove CodeQL job
ef78354 ci: fix all 24 ESLint problems blocking CI lint step
5f0707c fix: scope Vitest to __tests__/unit/ to prevent Playwright spec conflict
4abea97 ci: add Dockerfile and CD deploy workflow for GLPI-SRV
52426e2 ci: set SSH port 2222 for GLPI-SRV deployment
55467ee docs: add CI/CD section and finalize testing documentation
```
