# Rotina

App de rotina pessoal (PWA): sono, deslocamento, treino e peso.
HTML, CSS e JavaScript puros — sem framework e sem etapa de build.

A métrica que importa não é "fiz ou não fiz", é a distância entre o horário
planejado e o horário real, medida ao longo de semanas.

## Rodar localmente

Precisa de um servidor HTTP: o app usa módulos ES e service worker, que não
funcionam abrindo o `index.html` direto do disco.

```bash
python -m http.server 8123
```

Depois abra `http://localhost:8123`.

## Publicar no GitHub Pages

1. Suba os arquivos na raiz do repositório.
2. Em **Settings → Pages**, escolha a branch e a pasta `/ (root)`.
3. Abra a URL no Safari do iPhone e use **Compartilhar → Adicionar à Tela de Início**.

O deploy é automático: [.github/workflows/publicar.yml](.github/workflows/publicar.yml)
roda a cada push na `main`, carimba a versão do service worker e publica.

### Como a atualização chega ao iPhone

`ferramentas/versionar.js` calcula um hash do conteúdo de todos os arquivos
servidos e escreve esse hash em `VERSAO`, no `sw.js`. Mudou um byte do app, muda
o nome do cache; não mudou, a versão fica igual e ninguém recebe atualização
fantasma. O hash normaliza CRLF, então bate igual no Windows e no runner do
GitHub.

O service worker novo instala e **espera** — não assume sozinho. O app procura
versão nova a cada 30 minutos, ao voltar para a tela e ao reconectar (é o que
importa no iPhone, onde o app fica suspenso). Quando encontra, mostra a barra
"Nova versão disponível". Ao tocar em **Atualizar**, o worker assume, a página
recarrega e todos os arquivos vêm da mesma versão — nunca metade novos, metade
velhos. O cache antigo é apagado na ativação.

Para carimbar a versão localmente, sem publicar:

```bash
node ferramentas/versionar.js
```

## Estrutura

Lógica e apresentação são pastas separadas. `js/nucleo/` não conhece DOM, classe
CSS nem cor; `js/ui/` não decide regra nenhuma.

```
index.html          casca do app
app.js              abas, rota por hash, ciclo de redesenho
styles.css          todo valor visual, em variáveis CSS no :root
manifest.json       PWA
sw.js               cache offline

js/nucleo/          LÓGICA — puro, testável, sem navegador à vista
  store.js          modelo de dados, perfil de exemplo, localStorage (chave rotina.v1)
  util.js           datas, horários, números e a regra de tolerância
  agenda.js         rotina recorrente → ocorrências do dia, previsto × real
  acoes.js          o que o botão principal oferece agora e o que cada toque grava
  aderencia.js      situação diária, calendário, sequência
  deslocamento.js   mediana por trajeto e sugestão de horário de saída
  peso.js           média móvel de 7 dias
  treino.js         última carga, progressão, deload, quilometragem por tênis
  cronometro.js     máquina de estados do cronômetro de intervalo
  resumo.js         texto da semana pronto para copiar

js/ui/              APRESENTAÇÃO — desenha, escuta toque, faz barulho
  dom.js            criação de elementos e tradução situação → classe CSS
  cartao.js         a anatomia única de cartão do painel
  icones.js         ícones Lucide em SVG inline
  folha.js          folha inferior, seletores, avisos
  grafico.js        gráficos completos em SVG: eixo Y à direita, grade, datas
  linhaDoTempo.js   régua das 5:00 à meia-noite
  alarme.js         bipe, vibração e trava de tela
  arquivos.js       download, leitura e cópia
  telas/            hoje, insights, treino, peso, ajustes
```

### Direção visual

Painel analítico claro, no estilo do App Store Connect e do iCloud Developer
Dashboards. Tema claro apenas. Tipografia SF Pro — Text abaixo de 20px, Display
a partir de 20px, tracking −0.02em nos números grandes — servida pelo sistema,
sem fonte hospedada, com Inter de reserva fora da Apple. Espaçamento na grade de
8pt das Human Interface Guidelines. Ícones Lucide desenhados em SVG inline.

Cinco abas: Hoje · Insights · Treino · Peso · Ajustes. A aba Insights concentra
os gráficos de tendência — hora de acordar, sono, peso e aderência.

### A fronteira

O núcleo classifica cada registro em `noAlvo`, `deriva`, `fora` ou `semRegistro`
— nomes de situação, não de cor. Quem traduz isso para verde, amarelo e vermelho
é `classeSituacao()` em [js/ui/dom.js](js/ui/dom.js), o único ponto de contato
entre os dois vocabulários.

Geometria orientada a dado (posição dos blocos na linha do tempo, barra do
cronômetro) passa por `variaveis()`, também em `dom.js`: o JS escreve números sem
unidade em variáveis CSS (`--inicio: 430`) e o `styles.css` decide quantos pixels
vale um minuto. É o único lugar do JS que toca o atributo `style`.

## Dados

Tudo fica em `localStorage`, numa única chave (`rotina.v1`), **por dispositivo e
por navegador**. Não há sincronização entre celular e computador: para levar os
dados de um para o outro, use **Ajustes → Exportar backup (JSON)** e
**Importar backup**.

O app já vem com um perfil de exemplo carregado — rotina, trajetos, sessões de
treino e metas. Tudo é editável em **Ajustes**, e **Apagar tudo e recomeçar**
volta para esse perfil.

O exemplo é **genérico de propósito**. Este repositório é público, e rotina de
pessoa real é agenda de quando ela não está em casa. A sua rotina de verdade
você configura no aparelho: ela fica no `localStorage` e nunca sai dali.

## Atalhos de teclado (desktop)

| Tecla | Ação |
|---|---|
| `1` … `5` | Hoje · Insights · Treino · Peso · Ajustes |
| `r` | aciona o botão principal da tela Hoje |

## O que não dá para fazer

Web app não tem acesso ao Apple Saúde nem ao Whoop, não recebe notificações push
no iOS, não vira widget de tela de início e não consulta trânsito ao vivo.
