# Solyd3D — ERP & Gestão de Produção para Impressão 3D FDM

O **Solyd3D** é um sistema de Planejamento de Recursos Empresariais (ERP) e Gestão de Manufatura da Informação (MES) desenvolvido especificamente para empresas, estúdios e fazendas de impressão 3D focadas na tecnologia FDM (Deposição de Material Fundido: PLA, PETG, ABS, TPU, etc.).

O sistema oferece controle ponta a ponta sobre toda a cadeia operacional: desde a cotação instantânea de peças, controle rigoroso de insumos e consumo de filamento grama a grama, acompanhamento visual via Kanban de Produção, remessas em consignação para pontos de venda parceiros, até o demonstrativo financeiro e acerto de contas (netting) entre sócios.

---

## 🏛️ Arquitetura & Tecnologia

- **Core & Framework:** Next.js 16 (App Router / React 19) + Node.js
- **Banco de Dados:** PostgreSQL (via Neon Cloud DB) + Prisma ORM 7.8
- **Autenticação & Segurança:** NextAuth.js com JWT + Controle de Acesso Baseado em Cargos (`ADMIN` / `USER`)
- **Estilização & UI:** Vanilla CSS moderno (Glassmorphism, Dark Theme, Design Tokens em `globals.css`) + Ícones Lucide React
- **Gráficos & BI:** Recharts para visualização analítica de custos e faturamento

---

## 🚀 Funcionalidades & Módulos do Sistema

### 1. ⚙️ Configurações Globais & Chave de Estoque Granular (Toggle)
O sistema permite adaptar a rigidez do controle de almoxarifado de acordo com o momento da operação através de uma configuração global no banco de dados (`system_configs -> modo_estoque_granular`):

- **Modo Granular ATIVADO (`true`) — Controle por Gramas:**
  - Exige o cadastro do peso inicial do rolo de filamento (ex: 1000g).
  - Quando uma Ordem de Produção (OP) no Kanban é movida para o status **Concluído (`COMPLETED`)** ou **Falha (`FAILED`)**, o sistema solicita o peso real utilizado na impressão e **subtrai automaticamente esse valor do saldo (`remaining_weight_g`)** daquele rolo específico.
  - Se o saldo de um rolo chegar a zero (`<= 0g`), o sistema altera automaticamente seu status e o desativa (`is_active = false`), impedindo que seja selecionado em novas ordens.

- **Modo Simplificado DESATIVADO (`false`) — Apenas Ativo / Inativo:**
  - O sistema ignora a contagem progressiva de gramas no estoque físico.
  - O operador apenas indica se uma cor/material está "Ativa" (disponível na prateleira) ou "Inativa" (acabou).
  - Ao concluir impressões, nenhuma alteração de saldo é gravada no banco de dados, ideal para rotinas ágeis onde o controle físico de pesagem não é exigido.
  - *Nota:* O cálculo financeiro (custo do filamento por grama) continua funcionando perfeitamente em ambos os modos para fins de precificação.

---

### 2. 🖨️ Kanban de Produção (Manufatura Visual com Drag-and-Drop)
O módulo de **Produção (`/producao`)** foi projetado como um quadro Kanban horizontal interativo com 6 colunas, cobrindo todo o ciclo de vida da peça:

1. **Na Fila (`QUEUED`):** Ordens criadas aguardando preparação.
2. **Fatiado (`SLICED`):** Arquivo STL já processado no fatiador (Cura, PrusaSlicer, Orca), G-code gerado e exportado.
3. **Imprimindo (`PRINTING`):** Impressão ativa na máquina (o card exibe animação pulsante de atividade e grava o timestamp de início `startedAt`).
4. **Pós-Processamento (`POST_PROCESSING`):** Peça retirada da mesa passando por remoção de suporte, lixamento ou acabamento.
5. **Concluído (`COMPLETED`):** Peça finalizada, aprovada no controle de qualidade e adicionada automaticamente ao estoque pronto (`stockReady`) do produto no catálogo.
6. **Falha / Scrap (`FAILED`):** Registro de perda por descolamento, entupimento ou erro mecânico. O custo de material e energia é absorvido como prejuízo operacional (Scrap).

#### 🧲 Interatividade & Regras do Kanban:
- **Drag-and-Drop Nativo:** Cartões podem ser arrastados livremente entre colunas usando a API HTML5 Drag and Drop nativa.
- **Modais de Apontamento:** Ao arrastar um card para `COMPLETED` ou `FAILED`, o sistema abre um modal solicitando a pesagem final (`actualWeightG`) e o tempo real (`actualPrintMinutes`) para aferir o custo exato da peça no histórico.
- **Gatilho Reverso de Venda:** Se uma OP for criada manualmente indicando o destino para um cliente ("Venda Avulsa / Direta" ou "Encomenda") sem vínculo prévio, o sistema dispara um gatilho que **cria automaticamente a cobrança vinculada no módulo de Vendas (`/vendas`)** para garantir que nenhuma produção avulsa deixe de ser faturada.

---

### 3. 📦 Estoque & Almoxarifado (`/estoque`)
Gestão dual cobrindo matéria-prima e produtos finalizados:
- **Estoque de Filamentos (`FilamentRoll`):** Controle por Marca, Material (PLA, PETG, ABS), Cor, Peso Inicial/Restante, Custo por Rolo (R$) e Custo unitário por grama (`costPerGram`).
- **Estoque Pronto (`Product -> stockReady`):** Peças impressas prontas para venda ou envio para consignação em comércios parceiros.

---

### 4. 🧮 Calculadora Rápida de Orçamentos (`/calculadora`)
Ferramenta interativa de engenharia de custos para atendimento instantâneo ao cliente:
- Recebe o **Peso estimado (g)** e o **Tempo de impressão (horas/minutos)** gerados pelo fatiador.
- Considera o custo do filamento selecionado, consumo elétrico da máquina em Watts (`powerWatts`), tarifa de energia vigente (`R$/kWh`) e taxa de depreciação/manutenção da impressora.
- Aplica a margem de lucro desejada (`%` ou valor fixo) e sugere o preço ideal de venda, permitindo salvar a cotação como um novo produto no catálogo.

---

### 5. 🛍️ Vendas Diretas & Encomendas (`/vendas`)
Registro e acompanhamento financeiro de pedidos de clientes:
- Status de pedidos (`ACTIVE`, `DELIVERED`, `CANCELLED`).
- Vínculo bidirecional com as Ordens de Produção (permitindo clicar na OP do Kanban para abrir a venda e vice-versa).
- Detalhamento de itens, preços unitários, custos consolidados e lucro líquido por venda.

---

### 6. 📍 Pontos de Venda & Remessas em Consignação (`/remessas` e `/vendas/pontos`)
Módulo exclusivo para gestão de bancas, feiras, lojas colaborativas e comércios parceiros:
- **Cadastro de Pontos de Venda (`SalePoint`):** Nome, endereço, comissão do parceiro (`%`) e dados de contato.
- **Remessas (`Consignment`):** Envio de lotes de peças prontas do estoque do ERP para as prateleiras do parceiro.
- **Fechamento de Lote / Acerto de Consignação:** O sistema rastreia quantas peças foram vendidas, quantas foram devolvidas ao estoque físico e calcula automaticamente a comissão do ponto de venda e o valor líquido a receber.

---

### 7. 🛒 Compras, Insumos & Acerto entre Sócios (Netting) (`/compras`)
Módulo avançado de suprimentos com divisão societária:
- **Insumos & Suprimentos (`SupplyItem`):** Controle de peças de reposição (bicos, mesas PEI, tubos PTFE, álcool isopropílico, embalagens).
- **Compras (`Purchase`):** Registro de notas fiscais e aquisições.
- **Divisão & Netting entre Sócios (`PurchaseSplit` & `Partner`):**
  - Cadastro de sócios/parceiros com percentual societário (`equityPercentage`).
  - Cada compra registra quem pagou (`paidByPartnerId`) e como a despesa deve ser dividida (`splits`).
  - O motor de **Netting Automático (`/api/purchases/netting`)** cruza o saldo de todas as compras pagas por cada sócio em relação à sua cota parte, calculando exatamente quem deve transferir para quem ao final do mês para zerar as contas.

---

### 8. 📊 Módulo Financeiro & DRE Operacional (`/financeiro`)
Visão executiva da saúde financeira da fábrica 3D:
- **Despesas Fixas (`FixedExpense`):** Aluguel, internet, salários, softwares e manutenção programada de máquinas.
- **Despesas Variáveis (`VariableExpense`):** Embalagens, fretes, taxas de pagamento e perdas.
- **Apuração Operacional (DRE Simplificada):**
  - Faturamento Bruto (Vendas + Fechamentos de Consignação).
  - (–) Custos Diretos de Manufatura (Filamentos consumidos + Energia elétrica).
  - (–) Despesas Fixas & Variáveis.
  - (=) **Lucro Líquido Real da Operação**.
- Gráficos analíticos integrados via `Recharts`.

---

### 9. 🛡️ Controle de Acesso & Auditoria (`/usuarios` e `ActivityLog`)
- **Perfis de Usuário (`Role`):**
  - `ADMIN`: Acesso irrestrito a configurações, tarifação de energia, cadastro de máquinas, usuários e acerto de sócios.
  - `USER`: Operadores focados na gestão do Kanban, apontamento de produção e controle de almoxarifado.
- **Trilha de Auditoria (`ActivityLog`):** Registro imutável de todas as ações sensíveis (criação de OPs, conclusão de impressões, alteração da chave de estoque granular, exclusão de registros).

---

## 🛠️ Guia de Instalação & Execução Local

### Pré-requisitos
- **Node.js** v18.18+ ou v20+
- **npm** v9+ (ou `pnpm` / `yarn`)
- Instância PostgreSQL (local ou nuvem como Neon, Supabase, Railway)

### 1. Clonar o Repositório e Instalar Dependências
```bash
git clone https://github.com/SeuUsuario/solyd3d.git
cd solyd3d
npm install
```

### 2. Configurar Variáveis de Ambiente (`.env`)
Crie um arquivo `.env` na raiz do projeto contendo as credenciais de acesso ao banco e chave de autenticação:

```env
# URL de conexão com o PostgreSQL
DATABASE_URL="postgresql://usuario:senha@host.neon.tech/neondb?sslmode=require"

# NextAuth Secret & URL
NEXTAUTH_SECRET="sua-chave-secreta-de-seguranca-32-caracteres"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Sincronizar o Banco de Dados (Prisma)
Envie o schema para o seu banco PostgreSQL e gere os artefatos locais do cliente ORM:

```bash
# Sincronizar as tabelas com o banco de dados
npx prisma db push

# Gerar o Prisma Client em src/generated/prisma
npx prisma generate
```

### 4. Executar em Modo de Desenvolvimento
```bash
npm run dev
```
Acesse **http://localhost:3000** em seu navegador para utilizar o sistema.

---

## 📦 Build para Produção (`npm run build`)

Para rodar em ambiente produtivo com máxima performance, sem tempo de compilação sob demanda:

```bash
# Gerar o bundle otimizado de produção
npm run build

# Iniciar o servidor de produção localmente
npm start
```

---

## 📁 Estrutura do Código-Fonte (`/src`)

```
solyd3d/
├── prisma/
│   └── schema.prisma        # Definição dos modelos ORM e enums do PostgreSQL
├── src/
│   ├── app/                 # Next.js App Router (Páginas e API Routes)
│   │   ├── api/             # Endpoints REST (/production-orders, /system-config, /purchases/netting, etc.)
│   │   ├── producao/        # Kanban Visual de Produção (Drag-and-Drop)
│   │   ├── configuracoes/   # Toggle de Estoque Granular, Cadastro de Máquinas e Tarifas de Energia
│   │   ├── calculadora/     # Precificador instantâneo de peças
│   │   ├── vendas/          # Gestão de Vendas Diretas e Consignações
│   │   ├── estoque/         # Almoxarifado de Filamentos e Peças Prontas
│   │   ├── compras/         # Suprimentos e Netting Societário
│   │   └── financeiro/      # DRE e Despesas Fixas/Variáveis
│   ├── lib/                 # Utilitários Core do Sistema
│   │   ├── calculations.js  # Motor de cálculo de custos de material, energia e precificação
│   │   ├── formatters.js    # Formatadores de moeda (R$), pesos (g), datas e labels de status
│   │   ├── activityLogger.js# Sistema de registro de auditoria no banco de dados
│   │   └── prisma.js        # Singleton do Prisma Client
│   └── middleware.js        # Proteção de rotas via NextAuth (Controle JWT e verificação de ADMIN)
└── package.json             # Scripts de build e dependências
```

---
*Desenvolvido pela equipe Solyd3D.*
