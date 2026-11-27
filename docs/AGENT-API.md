# NoteScan — Guia da API para agentes

> Para colar nas instruções de um agente (Claude Code, Hermes etc.). Gerado a partir do
> código das rotas e dos schemas Zod (m8-01, Etapa 2). Em caso de dúvida, o código
> prevalece.

## 1. Conexão

- **URL base:** `https://notescan.itcbr.xyz/api`
- **Autenticação:** header `Authorization: Bearer <token>`. O token começa com `nsk_`.
- **O token fica só na variável de ambiente `NOTESCAN_TOKEN`.**
  - Nunca escreva o token em comandos, arquivos, logs ou mensagens.
  - Nunca coloque o token na URL ou em query string.
  - Sempre referencie `$NOTESCAN_TOKEN`.
- Corpo das requisições em JSON: `Content-Type: application/json`.

```bash
export NOTESCAN_TOKEN=<cole o token>   # feito pelo usuário, uma vez
export NOTESCAN_URL=https://notescan.itcbr.xyz/api
```

Todos os exemplos abaixo usam essas duas variáveis.

**Leia este guia antes de operar.** Qualquer token válido pode lê-lo, sem escopo exigido:

```bash
curl -s "$NOTESCAN_URL/agents/guide" -H "Authorization: Bearer $NOTESCAN_TOKEN"
```

A resposta vem em texto puro (`text/plain`). Um token revogado, expirado ou de agente
desativado recebe **401**.

## 2. Escopos

O token traz um ou mais escopos, escolhidos pelo administrador (MASTER) na emissão. Os
escopos são independentes: nenhum inclui outro.

| Escopo | O que libera |
|---|---|
| `read:catalog` | Ler projetos, UMs, notebooks e o histórico de cada notebook |
| `write:catalog` | Criar e editar projetos, UMs e notebooks (um a um, em lote e por import) |
| `delete:catalog` | Arquivar ou excluir um notebook por vez |
| `destructive` | **Só junto com `delete:catalog`:** excluir UM, excluir projeto e arquivar ou excluir todos os notebooks de uma UM |

Um token sem o escopo exigido recebe **403**. O token vale 365 dias.

## 3. Limites

| Tipo | Limite por agente |
|---|---|
| Leitura (GET) | 120 por minuto |
| Escrita e exclusão | 30 por minuto |

Acima do limite, a API responde **429**. Veja a seção 7.

Prefira as operações em lote (`/notebooks/batch` e `/notebooks/import`) a muitas chamadas
individuais.

## 4. Endpoints

### 4.1 Leitura (`read:catalog`)

#### `GET /projects`
Lista os projetos em ordem alfabética, com o número de UMs.

```bash
curl -s "$NOTESCAN_URL/projects" -H "Authorization: Bearer $NOTESCAN_TOKEN"
```
```json
[
  { "id": "cm...", "nome": "Brasil.IA", "cor": "#00AACC",
    "createdAt": "2026-10-01T12:00:00.000Z", "updatedAt": "2026-10-01T12:00:00.000Z",
    "_count": { "ums": 4 } }
]
```

#### `GET /ums`
Lista as UMs ordenadas por projeto e por nome. `_count.notebooks` conta só os notebooks
**não arquivados**.

```bash
curl -s "$NOTESCAN_URL/ums" -H "Authorization: Bearer $NOTESCAN_TOKEN"
```
```json
[
  { "id": "cm...", "nome": "BSBIA01", "projectId": "cm...", "quantidadeEsperada": 106,
    "perifericos": true, "mouses": true, "carregadores": true, "fones": false,
    "createdAt": "...", "updatedAt": "...",
    "project": { "id": "cm...", "nome": "Brasil.IA", "cor": "#00AACC" },
    "_count": { "notebooks": 106 } }
]
```

#### `GET /notebooks`
Lista os notebooks ordenados por projeto, UM e hostname.

| Parâmetro (query) | Efeito |
|---|---|
| `umId=<id>` | Só os notebooks dessa UM |
| `includeArchived=1` | Inclui os `ARQUIVADO`; sem ele, eles ficam de fora |

```bash
curl -s "$NOTESCAN_URL/notebooks?umId=$UM_ID" -H "Authorization: Bearer $NOTESCAN_TOKEN"
```
```json
[
  { "id": "cm...", "hostname": "BSBIA01-EST01", "serial": "5CD1234", "patrimonio": "000123",
    "status": "ATIVO", "umId": "cm...", "createdAt": "...", "updatedAt": "...",
    "um": { "id": "cm...", "nome": "BSBIA01",
            "project": { "id": "cm...", "nome": "Brasil.IA", "cor": "#00AACC" } } }
]
```

`status` pode ser `ATIVO`, `MANUTENCAO` ou `ARQUIVADO`.

#### `GET /notebooks/{id}/history`
Retorna o histórico do notebook (LifecycleEvent), do mais recente para o mais antigo.

```bash
curl -s "$NOTESCAN_URL/notebooks/$NB_ID/history" -H "Authorization: Bearer $NOTESCAN_TOKEN"
```
```json
[
  { "id": "cm...", "notebookId": "cm...", "userId": "cm...", "tipo": "Manutenção",
    "descricao": "Notebook colocado em manutenção", "createdAt": "...",
    "user": { "nome": "Fulano" } }
]
```

### 4.2 Escrita (`write:catalog`)

#### `POST /projects`
| Campo | Tipo | Regra |
|---|---|---|
| `nome` | string | Obrigatório, de 1 a 100 caracteres |
| `cor` | string | Obrigatório, hex `#RRGGBB` |

```bash
curl -s -X POST "$NOTESCAN_URL/projects" -H "Authorization: Bearer $NOTESCAN_TOKEN" \
  -H "Content-Type: application/json" -d '{"nome":"Brasil.IA","cor":"#00AACC"}'
```
Resposta **201** com o projeto criado: `{ "id", "nome", "cor", "createdAt", "updatedAt" }`.

#### `PUT /projects/{id}`
Mesmo corpo do POST, **completo** (`nome` e `cor`). A resposta **200** traz o projeto.

#### `POST /ums`
| Campo | Tipo | Regra |
|---|---|---|
| `nome` | string | Obrigatório, de 1 a 100 caracteres |
| `projectId` | string | Obrigatório |
| `quantidadeEsperada` | inteiro | Obrigatório, ≥ 1 |
| `perifericos`, `mouses`, `carregadores`, `fones` | boolean | Opcionais, padrão `false` |

```bash
curl -s -X POST "$NOTESCAN_URL/ums" -H "Authorization: Bearer $NOTESCAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nome":"BSBIA05","projectId":"'"$PROJECT_ID"'","quantidadeEsperada":106}'
```
A resposta **201** traz a UM no mesmo formato de `GET /ums`.

#### `PUT /ums/{id}`
Mesmo corpo do POST. Os campos booleanos omitidos voltam a `false`, então envie todos. A
resposta **200** traz a UM.

#### `POST /notebooks`
Cadastra um notebook.

| Campo | Tipo | Regra |
|---|---|---|
| `hostname` | string | Obrigatório, de 1 a 100 caracteres, único. Não pode terminar com o sufixo reservado `~arq-AAAAMMDD` |
| `umId` | string | Obrigatório |
| `serial`, `patrimonio` | string | Opcionais |
| `status` | `"ATIVO"` \| `"MANUTENCAO"` | Opcional, padrão `ATIVO` |
| `onArchived` | `"reactivate"` \| `"new"` | Opcional. Veja a seção 5.2 |

```bash
curl -s -X POST "$NOTESCAN_URL/notebooks" -H "Authorization: Bearer $NOTESCAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hostname":"BSBIA01-EST01","umId":"'"$UM_ID"'","serial":"5CD1234"}'
```
A resposta **201** traz o notebook com `um` (mesmo formato de `GET /notebooks`).

#### `POST /notebooks/batch`
Cadastra em lote uma sequência de hostnames no formato `prefix` + número.

| Campo | Tipo | Regra |
|---|---|---|
| `prefix` | string | Obrigatório, de 1 a 50 caracteres, sem `~arq-` |
| `start`, `end` | inteiro | Obrigatórios, ≥ 1, com `end ≥ start` |
| `umId` | string | Obrigatório |
| `status` | `"ATIVO"` \| `"MANUTENCAO"` | Opcional, padrão `ATIVO` |
| `onArchived` | `"skip"` \| `"reactivate"` \| `"new"` | Opcional, padrão `skip`. Veja a seção 5.3 |

Os números de 1 a 9 recebem zero à esquerda e os de 10 em diante, não:
`BSBIA01-EST` com `start` 1 e `end` 12 gera `BSBIA01-EST01` … `BSBIA01-EST09`,
`BSBIA01-EST10` … `BSBIA01-EST12`.

```bash
curl -s -X POST "$NOTESCAN_URL/notebooks/batch" -H "Authorization: Bearer $NOTESCAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prefix":"BSBIA01-EST","start":1,"end":100,"umId":"'"$UM_ID"'"}'
```
```json
{ "total": 100, "created": 98, "reactivated": 0,
  "archivedConflicts": ["BSBIA01-EST07"], "blocked": [] }
```
**201.** Quando `created` for menor que `total`, a diferença são hostnames que já existiam
ativos e foram **ignorados sem erro**, ou conflitos com arquivados (`archivedConflicts`).
Confira os números antes de concluir.

#### `POST /notebooks/import`
Importa uma lista de notebooks com serial e patrimônio.

| Campo | Tipo | Regra |
|---|---|---|
| `umId` | string | Obrigatório |
| `rows` | array | Pelo menos 1 item: `{ "hostname", "serial"?, "patrimonio"? }` |
| `onArchived` | `"skip"` \| `"reactivate"` \| `"new"` | Opcional, padrão `skip` |

Todos entram como `ATIVO`. A resposta tem o mesmo formato e o mesmo código (**201**) do
`/batch`.

```bash
curl -s -X POST "$NOTESCAN_URL/notebooks/import" -H "Authorization: Bearer $NOTESCAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"umId":"'"$UM_ID"'","rows":[{"hostname":"BSBIA01-EST01","serial":"5CD1234","patrimonio":"000123"}]}'
```

#### `PUT /notebooks/{id}`
Edita um notebook. O corpo é **completo**:

| Campo | Tipo | Regra |
|---|---|---|
| `hostname` | string | Obrigatório, sem o sufixo reservado |
| `umId` | string | Obrigatório |
| `status` | `"ATIVO"` \| `"MANUTENCAO"` | Obrigatório |
| `serial`, `patrimonio` | string | Opcionais |

Trocar entre `ATIVO` e `MANUTENCAO` registra um evento no histórico. Notebook
`ARQUIVADO` não pode ser editado (**409**). Para trazê-lo de volta, use o fluxo de
reativação da seção 5.2. A resposta **200** traz o notebook.

### 4.3 Exclusão

#### `DELETE /notebooks/{id}` — `delete:catalog`
- Notebook **sem histórico** (sem conferência nem evento): é excluído de vez.
- Notebook **com histórico**: é **arquivado**, nunca apagado. Veja a seção 5.1.

```bash
curl -s -X DELETE "$NOTESCAN_URL/notebooks/$NB_ID" -H "Authorization: Bearer $NOTESCAN_TOKEN"
```
```json
{ "action": "archived" }
```
A resposta é **200**, com `action` `"archived"` ou `"deleted"`. Um notebook já arquivado
devolve **409**.

#### `POST /notebooks/bulk-delete` — `delete:catalog` + `destructive`
Aplica a mesma regra a **todos** os notebooks não arquivados de uma UM, numa única
transação.

```bash
curl -s -X POST "$NOTESCAN_URL/notebooks/bulk-delete" -H "Authorization: Bearer $NOTESCAN_TOKEN" \
  -H "Content-Type: application/json" -d '{"umId":"'"$UM_ID"'"}'
```
```json
{ "deleted": 3, "archived": 103 }
```
**200.** Esta operação atinge a UM inteira: **confirme com o usuário antes de executar.**

#### `DELETE /ums/{id}` — `delete:catalog` + `destructive`
A resposta é **204**. Uma UM com qualquer notebook, mesmo arquivado, devolve **409**.

#### `DELETE /projects/{id}` — `delete:catalog` + `destructive`
A resposta é **204**. Um projeto com UMs devolve **409**.

## 5. Regras de negócio

### 5.1 Arquivamento e o sufixo `~arq-`
- Um notebook com histórico nunca é apagado. Ao ser "excluído", ele vira `ARQUIVADO`, e o
  hostname ganha o sufixo `~arq-AAAAMMDD`, com a data no fuso de São Paulo. Se houver
  colisão no mesmo dia, o sufixo recebe `-2`, `-3` e assim por diante.
  Exemplo: `BSBIA01-EST07` vira `BSBIA01-EST07~arq-20261126`.
- Isso libera o hostname original para outro cadastro.
- O padrão `~arq-AAAAMMDD` é **reservado**: hostname ou prefixo que o use recebe **400**.
- Notebooks arquivados não aparecem em `GET /notebooks` sem `includeArchived=1` e não
  contam em `_count.notebooks` das UMs.

### 5.2 Reativar × cadastrar como novo (`ARCHIVED_MATCH`)
Quando o hostname de um cadastro individual (`POST /notebooks`) é o hostname original de um
notebook arquivado:

1. **Sem `onArchived`**, a API responde **409** e não grava nada:
   ```json
   { "message": "Este hostname pertence a um notebook arquivado",
     "code": "ARCHIVED_MATCH",
     "archived": { "id": "cm...", "hostname": "BSBIA01-EST07", "umNome": "BSBIA01" } }
   ```
2. Pergunte ao usuário qual decisão tomar e reenvie com uma das opções:
   - `"onArchived": "reactivate"`: o **mesmo registro** volta a `ATIVO`, com o hostname
     original e a UM informada, e o histórico continua. Fica registrado o evento
     `REATIVADO`.
   - `"onArchived": "new"`: cria **outro registro**, com histórico novo. O arquivado fica
     como está.
3. Se já existir um notebook **ativo** com aquele hostname, a resposta é **409**
   `ACTIVE_EXISTS`.

### 5.3 Lote e import com arquivados
Em `/batch` e `/import`, a decisão vale para o lote inteiro, sem perguntar item por item:

| `onArchived` | Efeito para os hostnames que coincidem com arquivados |
|---|---|
| `skip` (padrão) | Não cria nada para eles e lista em `archivedConflicts` |
| `reactivate` | Reativa cada um. Os que não puderem (já existe ativo) vão para `blocked` |
| `new` | Cria registros novos para eles |

Hostnames que já existem **ativos** são ignorados sem erro e reduzem `created`.

### 5.4 Exclusões
- Projeto: só pode ser excluído sem UMs.
- UM: só pode ser excluída sem notebooks, contando os arquivados, porque o histórico deles
  referencia a UM.
- Para esvaziar uma UM, use `bulk-delete`: os notebooks sem histórico são excluídos e os
  com histórico, arquivados. Os arquivados continuam ligados à UM, então ela segue sem
  poder ser excluída.

### 5.5 Auditoria
- Toda escrita e exclusão de projeto e de UM fica registrada no AuditLog, com o agente e o
  token usados.
- Notebooks são registrados no histórico (LifecycleEvent) em nome do agente.

## 6. Proibido para agentes

As rotas abaixo respondem **403** a qualquer token, mesmo com todos os escopos. Não tente
contornar:

- conferências (`/conferences`, `/conferences/dashboard`)
- usuários (`/users`, `/users/change-password`)
- notificações (`/notifications/*`)
- gestão de agentes e tokens (`/agents`, `/agents/{id}` e sub-rotas). Exceção:
  `GET /agents/guide`, que qualquer token válido pode ler (seção 1)

## 7. Erros e o que fazer

O corpo de erro sempre traz `message`. O 400 traz também `errors`, com os detalhes da
validação Zod, e alguns 409 trazem `code`.

| Código | Significado | O que o agente deve fazer |
|---|---|---|
| **400** | Dados inválidos (campo faltando, formato, sufixo `~arq-`, `end < start`) | Corrija o corpo pelo `errors` e reenvie uma vez. Não repita o mesmo corpo |
| **401** | Token ausente, inválido, revogado ou expirado, ou agente desativado | **Pare.** Avise o usuário que o token precisa ser reemitido. Não tente outro token |
| **403** | Falta escopo, ou a rota é proibida a agentes | **Não insista.** Informe qual escopo faltou (seção 2) e deixe a decisão ao usuário |
| **404** | Registro não encontrado | Releia a lista (`GET`) para obter o `id` correto |
| **409** | Regra de negócio: duplicado (`ACTIVE_EXISTS`), arquivado (`ARCHIVED_MATCH`), notebook arquivado não editável, UM ou projeto com vínculos, ou histórico ganho durante a operação | Leia `message` e `code`. Em `ARCHIVED_MATCH`, pergunte ao usuário (seção 5.2). Se a mensagem disser "Tente novamente", repita uma vez. Nos demais casos, não force |
| **429** | Limite de requisições (seção 3) | Aguarde alguns segundos, de preferência 10 s ou mais, e repita com ritmo menor |
| **500** | Erro interno | Repita uma vez depois de alguns segundos. Se persistir, pare e avise |

## 8. Boas práticas

- Leia antes de escrever: confira `id`s com `GET` em vez de supor.
- Confirme com o usuário antes de `bulk-delete`, de excluir UM ou projeto e de qualquer
  `onArchived`.
- Em lote, confira `created`, `reactivated`, `archivedConflicts` e `blocked` e relate os
  números ao usuário.
- Nunca exiba nem registre o valor de `$NOTESCAN_TOKEN`.
