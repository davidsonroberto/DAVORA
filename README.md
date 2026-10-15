# DAVORA Brasil

Versão de preparação de 15/10/2026, em português e BRL. Conserva as cores e a estrutura visual da DAVORA do GitHub e substitui a vitrine incompleta de afiliados por 16 produtos reais de beleza.

## O que funciona

- Busca por nome, marca ou categoria, inclusive sem acentos.
- Fotos dos produtos, detalhes, seleção de itens, quantidades e remoção.
- Seleção persistida no navegador; dados pessoais não são guardados no localStorage.
- Formulário de entrega e Stripe Checkout embutido na própria página, condicionado à ativação do servidor. Cartões e Google Pay dependem da conta/dispositivo; Pix só é incluído quando habilitado explicitamente.
- APIs de cotação assinada, criação idempotente de sessão Stripe Checkout e consulta autoritativa do pagamento na Stripe. Valores são calculados no servidor, nunca aceitos do navegador.

**As compras estão desativadas.** Produtos identificados em catálogos públicos não equivalem a acordo de fornecimento. Preços de revenda, estoque e regras comerciais são ocultos sem acesso à conta Dropi. Não houve contratação, importação para uma conta de lojista, pagamento nem pedido ao fornecedor. Não há comissão garantida de 50%.

## Catálogo e origem das fotos

`data/catalog.json` registra marca, SKU, referência do produto e imagem pública de cada item. Foram selecionados produtos Bitarra Beauty e Vitamédica dos catálogos públicos abaixo, consultados em 15/10/2026. As descrições são curtas e sem promessas terapêuticas.

- https://app.dropi.com.br/marketplace/fornecedor/bitarra-beauty
- https://app.dropi.com.br/marketplace/fornecedor/vitamedica
- https://dropi.sak.com.br/como-funciona-o-dropnacional

Cada produto está com `supplierApproved: false`, `availability: pending_confirmation`, `priceCents: null`, `stock: null`. Fotos são carregadas do CDN de origem. Estoque anunciado só é aceito se confirmado há menos de 24 horas.

## Hospedagem e situação da publicação

O repositório pode continuar no GitHub. **GitHub Pages não permite hospedar uma operação de comércio eletrônico**, conforme https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits . O código usa funções Node para a parte de pagamento e precisa de hospedagem compatível, com plano que permita uso comercial.

O projeto Vercel `davora` foi localizado. A consulta detalhada retornou 403 por falta de acesso ao escopo da conta, mas a conexão automática GitHub–Vercel gerou uma prévia ao receber esta branch. O status do commit confirmou a publicação como Ready. Prévia: https://davora-git-codex-davora-brasil-20261015-davidsonroberto.vercel.app . Não foi possível administrar as configurações do projeto. O Opera retornou navegador desconectado. O site principal e os domínios não foram alterados; a prévia permanece sem compras ativas.

## Dependências antes de vender

1. Acessar a conta Dropi/DropNacional e obter a autorização de revenda dos fornecedores, confirmando SKU, cor, quantidade, custo, estoque e uso de fotos.
2. Confirmar frete e prazo por pedido completo, inclusive pedidos com fornecedores diferentes. Não copiar custos do AliExpress antigo.
3. Definir preços em `priceCents`, em centavos. Margem de 50% antes das demais despesas exige preço de venda igual a duas vezes o custo considerado; taxas, frete subsidiado, impostos, anúncios e devoluções diminuem o lucro. Fazer a conta com custos reais antes de escolher o preço.
4. Conectar a hospedagem à Stripe por configuração segura do servidor. A conexão do ChatGPT foi verificada em 15/10/2026: conta brasileira em BRL, somente ambiente de teste disponível nesta sessão, cartões habilitados e sem exigências cadastrais pendentes na consulta. Isso não comprova a ativação da conta de produção. As credenciais da hospedagem continuam sem configuração. Nenhuma chave deve ser enviada por mensagem ou incluída no GitHub.
5. Completar identificação comercial da loja, condições de entrega, atendimento, privacidade, trocas e devoluções com dados reais do responsável.
6. Integrar registro durável de pedidos, acompanhamento/recuperação de pagamento, controle de estoque e rotina de repasse ao fornecedor. Esta versão **não** envia pedidos automaticamente ao Dropi nem reserva/decrementa estoque. As APIs são uma base de integração; não representam um sistema de pedidos concluído.
7. Testar compra, atualização de estoque, cobrança repetida, indisponibilidade, expiração, reembolso, registro do pedido e despacho em ambiente de teste antes de liberar vendas reais.

Depois destas etapas, a ativação exige todas as condições de `lib/store.js`, configurações explícitas de `.env.example`, produtos autorizados e preços/estoques confirmados. **Não ativar só preenchendo variáveis: o sistema de pedidos e as condições acima ainda precisam ser concluídos.**

`DAVORA_SHIPPING_RULES` aceita uma lista de regras por pedido completo com `cepStart` e `cepEnd` (8 dígitos), `priceCents` (inteiro) e `days` (inteiro). Faixas conflitantes são recusadas; não há taxa ou prazo de frete inventado como padrão.

## Verificação

Node 22 ou superior. Sem dependências npm para a aplicação. Stripe.js é carregado diretamente de https://js.stripe.com/endive/stripe.js ao abrir um pagamento, e a API usa a versão 2026-09-30.endive.

```sh
npm test
npm run check
git diff --check
```

Os 14 testes exercitam bloqueio de produtos pendentes, adulteração de preço/frete, estoque vencido, limites de quantidade, idempotência inclusive em repetições após atraso, configuração de Pix, separação teste/produção, confirmação autoritativa e recusa do webhook antigo. A chamada à Stripe é simulada; nenhuma cobrança foi realizada. As 16 imagens retornaram HTTP 200 na conferência de 15/10/2026. Sem teste visual em navegador nesta sessão.

Documentação do pagamento:
- https://docs.stripe.com/checkout/embedded/quickstart
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/google-pay?platform=web
- https://docs.stripe.com/payments/pix
- https://docs.stripe.com/api/versioning

Os endpoints antigos de currículo, consulta de pagamento e webhook estão desativados (HTTP 410). A loja não usa Mercado Pago. O webhook antigo recusa notificações e não deve ser cadastrado como destino. Um webhook Stripe com verificação de assinatura e processamento idempotente é obrigatório antes do lançamento: tratar `checkout.session.completed` e `checkout.session.async_payment_succeeded` somente com `payment_status: paid`, além das falhas assíncronas. O registro durável de pedidos, recuperação de sessão e repasse ao fornecedor também permanecem pendentes antes de vendas reais.


## Ativação da Stripe

- `STRIPE_SECRET_KEY`: preferir chave restrita (`rk_`) com as permissões mínimas necessárias, somente no servidor, em variável sensível da Vercel. Não enviar por mensagem nem incluir no repositório.
- `STRIPE_PUBLISHABLE_KEY`: chave publicável correspondente ao mesmo ambiente de teste ou produção.
- `STRIPE_PIX_ENABLED`: permanece `false` até verificar a elegibilidade e ativar Pix nesta conta.
- Cadastrar o domínio definitivo e os domínios de teste usados para Google Pay em https://dashboard.stripe.com/settings/payment_method_domains . Ativar as formas de pagamento desejadas na conta. O botão Google Pay só aparece quando os requisitos de conta, domínio, navegador e carteira são atendidos.
- Na consulta ao ambiente de teste em 15/10/2026, Google Pay e Pix estavam indisponíveis na configuração padrão e não havia domínios cadastrados. Nenhuma forma de pagamento ou configuração da conta foi alterada nesta verificação.
- A sugestão de adicionar a Stripe ao ChatGPT permite autorizar a conexão à conta; isso não transfere credenciais secretas para a hospedagem nem ativa o site automaticamente.
- A sessão usa `ui_mode: embedded_page`, `redirect_on_completion: never` e somente as formas permitidas por `allowed_payment_method_types`. A confirmação exibida pela loja depende da consulta ao servidor e exige `status: complete` e `payment_status: paid`, com valor, moeda, referência e ambiente compatíveis.
- A expiração deriva da cotação assinada para manter o corpo da requisição idêntico nas repetições com a mesma chave idempotente. `integration_identifier` identifica este fluxo no painel Stripe. A configuração Vercel inclui uma política de segurança de conteúdo compatível com Stripe.js e Checkout embutido.
- Nenhuma chave real foi adicionada e nenhuma sessão real de pagamento foi criada nesta alteração. Manter compras bloqueadas até concluir as dependências comerciais e operacionais acima.
