# Servidor de sincronização

Guarda o estado do app por código. Não sabe nada sobre rotina, peso ou sono:
para ele é um JSON opaco. São 47 linhas — dá para ler inteiro antes de subir.

## Subir (uma vez, ~5 minutos)

1. Crie uma conta em https://dash.cloudflare.com (o plano gratuito basta).
2. Instale o utilitário e entre na conta:

       npm install -g wrangler
       wrangler login

3. Crie o armazenamento e anote o `id` que ele imprime:

       wrangler kv namespace create ROTINA

4. Cole esse `id` em `wrangler.toml`, no lugar de `PREENCHER_COM_O_ID_DO_KV`.
5. Publique:

       wrangler deploy

   Ele imprime a URL, algo como `https://rotina-sync.SEU-NOME.workers.dev`.

## Ligar no app

Em cada aparelho: Ajustes → Sincronização → Entre meus aparelhos.
Cole a URL, gere um código **no primeiro aparelho** e use **o mesmo código**
nos outros dois.

## Sobre o código

É a única credencial: quem o tiver lê e escreve seus dados. Trate como senha.
Ele nunca aparece em URL compartilhada nem é enviado para lugar nenhum além do
seu próprio Worker.

`ORIGEM` em `wrangler.toml` restringe quem pode chamar o servidor pelo
navegador. Deixe apontando para o seu site.
