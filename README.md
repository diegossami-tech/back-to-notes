# Backtonotes

App estático em HTML, CSS e JavaScript puro para organizar links, notas, posts salvos, prints e arquivos em coleções pessoais.

## Visual

- **Paleta Caderno** (padrão) — fundo creme + único acento vermelhão (`#dc4a2c`) inspirado no design "uma cor só" do Substack
- **Sidebar como drawer** — sempre escondida, abre no botão do menu
- **Topbar minimalista** — wordmark "backtonotes" + busca + adicionar
- 4 outras paletas no painel de Tweaks (Lousa, Bosque, Linho & Tinta, Cobalto)

## O que tem

- **Coleções** pré-definidas (Para Estudar, Já Estudei, Meus Escritos, Posts Salvos, Links, Prints) + pastas personalizadas
- **Drag-and-drop** entre coleções (HTML5 nativo no desktop, long-press no celular)
- **Quick-add por clipboard** — cole link / texto / imagem em qualquer lugar
- **Drop externo** — arraste URLs ou arquivos do desktop direto pra dentro
- **Upload de fotos e arquivos** — escolha imagens, PDFs, documentos e outros arquivos do celular ou computador pelo editor
- **Previews ricos** para YouTube, Vimeo, Twitch, Spotify, Instagram, TikTok, X — com thumb real quando o provedor permite
- **Busca global** com `⌘K` / `Ctrl+K`
- **Filtro por tag + sort** (recentes / mais antigos / alfa)
- **Marcar como estudado** com um toque
- **Exportar / importar JSON** do acervo inteiro
- **Painel de Tweaks** com 3 controles que mudam o tom:
  - **Paleta** — Caderno (padrão) · Lousa (noturno) · Bosque · Linho & Tinta · Cobalto
  - **Ritmo** — Compacto · Confortável · Mural
  - **Voz** — Editorial (serifa) · Sóbria (sans)
- **Responsivo** — drawer em qualquer tamanho de tela, modais viram bottom sheets no celular, FAB sempre disponível

## Como deployar no GitHub Pages

1. Crie/use um repositório no GitHub (ex: `backtonotes`)
2. Faça upload dos arquivos da pasta `app/` na raiz do repositório:
   - `index.html`
   - `app.js`
   - `tweaks.js`
   - `styles.css`
   - `logo.svg` (opcional)
3. Em **Settings → Pages**, escolha branch `main` e pasta `/ (root)`
4. Aguarde alguns segundos — o site fica em `https://<seu-user>.github.io/<repo>/`

## Dados

Os dados ficam salvos no `localStorage` do navegador. Para fazer backup ou mover de um navegador para outro, use **Exportar** na sidebar — vai gerar um JSON que pode ser **Importado** depois.

## Limitações conhecidas

- **Instagram / X (Twitter)**: as páginas públicas não expõem a imagem real para scrapers sem autenticação. O app mostra um poster com gradiente da marca como fallback.
- **TikTok**: oEmbed funciona para vídeos públicos quando o CORS permite.
- **Backup automático**: por enquanto é responsabilidade do usuário fazer Export manualmente.

## Tecnologia

Vanilla JS, sem frameworks ou build step. Funciona em qualquer navegador moderno. Sem cookies, sem rastreamento, sem servidor — tudo no cliente.
