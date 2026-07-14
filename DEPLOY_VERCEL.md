# 🚀 Guia Completo de Deploy — Solyd3D na Vercel + Neon DB

Este guia prático ensina o passo-a-passo para colocar o seu **Mini-ERP Solyd3D** online na **Vercel** conectado ao seu banco de dados na nuvem da **Neon DB**, permitindo acesso seguro via celular ou computador de qualquer lugar.

---

## 📋 Pré-requisitos
Antes de começar, certifique-se de ter:
1. Uma conta no [GitHub](https://github.com/);
2. Uma conta na [Vercel](https://vercel.com/);
3. O link do seu banco de dados do [Neon DB](https://neon.tech/) (`DATABASE_URL`).

---

## Passo 1: Subir o Projeto para o GitHub

Para a Vercel compilar o seu site automaticamente sempre que houver uma atualização, precisamos colocar o código no GitHub.

### 1.1. No Terminal (pasta do projeto):
Abra o terminal na pasta raiz (`solyd3d`) e rode os comandos para inicializar o repositório local:

```powershell
git init
git add .
git commit -m "🚀 Primeiro commit: Solyd3D Mini-ERP Full-Stack"
```

### 1.2. Criar o repositório no GitHub:
1. Acesse o [GitHub](https://github.com/new) e clique em **New Repository**.
2. Dê o nome de `solyd3d` (deixe como **Private** ou **Public** como preferir).
3. **Não** marque "Add a README file" nem ".gitignore" (pois já temos no projeto).
4. Clique em **Create repository**.

### 1.3. Enviar os arquivos:
Copie e rode os 3 comandos que o GitHub mostrará na tela (exemplo abaixo, substitua `SEU_USUARIO` pelo seu usuário do GitHub):

```powershell
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/solyd3d.git
git push -u origin main
```

> [!NOTE]
> O arquivo `.env` **não** será enviado ao GitHub porque está protegido no nosso `.gitignore`. Suas senhas estão seguras!

---

## Passo 2: Conectar o Repositório na Vercel

1. Acesse o seu painel na [Vercel](https://vercel.com/dashboard).
2. Clique no botão preto **Add New... → Project**.
3. Na lista "Import Git Repository", encontre o repositório **`solyd3d`** que você acabou de criar e clique em **Import**.
4. Na tela de "Configure Project":
   - **Framework Preset:** Deixe como `Next.js` (ele detecta automaticamente).
   - **Root Directory:** Deixe `./`.
   - **Build and Output Settings:** Deixe os padrões (`npm run build`).

---

## Passo 3: Configurar as Variáveis de Ambiente (CRÍTICO)

Ainda na tela de **Configure Project** da Vercel, abra a aba **Environment Variables**. Você precisará adicionar exatamente **3 variáveis obrigatórias**:

### 1. `DATABASE_URL`
- **O que é:** O link de conexão com o banco de dados que está no seu arquivo `.env` local.
- **Valor (Exemplo):**
  ```env
  postgresql://neondb_owner:senha@ep-rough-lake-acs5t6zx.sa-east-1.aws.neon.tech/neondb?sslmode=require
  ```

### 2. `NEXTAUTH_SECRET`
- **O que é:** Uma chave secreta para assinar os tokens de segurança de login do sistema.
- **Valor (Exemplo - pode copiar esta abaixo):**
  ```env
  solyd3d-production-secret-key-super-secure-2026-xyz
  ```

### 3. `NEXTAUTH_URL`
- **O que é:** A URL principal onde o seu site vai rodar na Vercel.
- **Valor (Exemplo):**
  ```env
  https://solyd3d.vercel.app
  ```
  *(Dica: Se você não souber a URL exata do projeto antes do primeiro deploy, você pode colocar `https://solyd3d.vercel.app` por enquanto e depois atualizar se a Vercel gerar outro nome).*

> [!IMPORTANT]
> Certifique-se de clicar no botão **Add** para cada uma das 3 variáveis antes de prosseguir!

---

## Passo 4: Clicar em Deploy e Publicar! 🚀

1. Clique no botão azul **Deploy**.
2. A Vercel começará a compilar o seu projeto. Ela rodará automaticamente o `npm install` e o nosso script mágico `"postinstall": "prisma generate"`, criando a ponte com o banco Neon na nuvem.
3. Em cerca de **45 a 60 segundos**, você verá uma tela de comemoração com fogos de artifício e o link ao vivo do seu ERP (`https://solyd3d.vercel.app`)!

---

## Passo 5: O Primeiro Acesso em Produção (Login Master)

Assim que você abrir o link do seu site ao vivo pela primeira vez, você será direcionado para a tela escurecida de **Login (`/login`)**.

Como o banco em nuvem está limpo e sem usuários, o sistema possui a engrenagem de inicialização automática. Digite:
- 📧 **E-mail:** `admin@solyd3d.com`
- 🔑 **Senha:** `Admin@123`

Ao clicar em **Entrar no Sistema**:
1. O ERP identifica que é a primeira vez e que o banco está vazio;
2. Ele cria o seu usuário `ADMIN` com a senha criptografada em hash seguro;
3. Ele libera a sua sessão no Dashboard em tempo real!

---

## 🛠️ Solução de Problemas / FAQ

### P: O gráfico do Dashboard apareceu vazio em produção, é normal?
**R: Sim!** Como o banco na nuvem está recém-criado, ele ainda não tem impressões, insumos cadastrados nem acertos de remessas. Siga o roteiro abaixo no site para preencher os primeiros dados:
1. Cadastre 1 rolo de filamento em **Estoque**;
2. Cadastre sua impressora em **Configurações**;
3. Cadastre 1 produto em **Catálogo de Peças**;
4. Crie uma ordem de produção em **Produção** e mude para `CONCLUÍDO`;
5. Cadastre uma banca em **Comércios / Bancas** e envie/acerte uma remessa em **Remessas / Acertos**.
*(Ao voltar para o Dashboard, todos os gráficos interativos e curvas de receita surgirão instantaneamente!)*

### P: Como faço para atualizar o site no futuro?
**R:** A Vercel trabalha com **Integração Contínua (CI/CD)**. Sempre que você alterar um código no seu computador e fizer:
```powershell
git add .
git commit -m "Nova melhoria"
git push
```
A Vercel detecta o push e atualiza o seu site ao vivo sozinha em menos de 1 minuto! 🎉
