# DAVORA Brasil

Versão de preparação de 16/10/2026, em português e BRL, com foco em eletrônicos e acessórios para o Brasil. Conserva as cores e a estrutura visual da DAVORA do GitHub. A vitrine reúne 30 produtos reais consultados na conta Zendrop: áudio, cabos, carregadores, capinhas, pulseiras e acessórios de mesa. A seleção anterior da Infinito Loja foi substituída. Cada produto tem um modelo com SKU e custo consultados pela conexão oficial Zendrop. As condições comerciais finais e a integração de pedidos ainda precisam ser concluídas.

## O que funciona

- Busca por nome, marca ou categoria, inclusive sem acentos.
- Fotos dos produtos, detalhes, preços previstos em BRL, frete e prazo estimados, seleção de itens, quantidades e remoção.
- Seleção persistida no navegador; dados pessoais não são guardados no localStorage.
- Formulário de entrega e Stripe Checkout embutido na própria página, condicionado à ativação do servidor. Cartões e Google Pay dependem da conta/dispositivo; Pix só é incluído quando habilitado explicitamente.
- APIs de cotação assinada, criação idempotente de sessão Stripe Checkout, registro privado de pedidos e consulta autoritativa do pagamento na Stripe. Valores são calculados no servidor, nunca aceitos do navegador.
- Retomada da mesma sessão de pagamento após recarregar a página, na mesma aba e por até duas horas, sem criar outra cobrança. Só uma referência temporária e os itens da seleção ficam no sessionStorage; dados pessoais e client secret Stripe não são persistidos.
- Cotações antigas são descartadas se o CEP ou a seleção mudar durante a consulta. O servidor também recusa um CEP de entrega diferente do CEP cotado.

**As compras estão desativadas.** A conexão oficial Zendrop foi autorizada e verificada. Foram consultados os 30 produtos, suas 2.082 variantes e estimativas de frete para o Brasil. Foi selecionado um SKU exato por produto. A atualização não importou itens para a Wix de referência, não contratou planos e não realizou pagamento nem pedido ao fornecedor. Os 30 preços previstos em BRL incluem frete estimado por unidade e buscam 50% de margem bruta antes de taxas e demais despesas. Cotação final por pedido, integração de despacho e validação do pagamento continuam pendentes. Não há comissão garantida de 50%.

## Catálogo e origem das fotos

`data/catalog.json` registra os 30 IDs Zendrop, nomes, fotos, textos em português e uma variante exata por produto. `supplierProductId` é o ID do produto; `supplierVariantId` e `supplierSku` identificam o modelo/cor selecionados. A consulta conferiu 2.082 variantes, com paginação concluída, disponibilidade e estimativas de transporte obtidas pelo app oficial. O arquivo de conferência completo fica fora da publicação da vitrine. Quando ele está disponível localmente em `data/zendrop-verification.json`, a validação cruza cada SKU, custo e estimativa com os registros originais. A vitrine mantém 30 produtos; não cria um cartão para cada variante alternativa.

Os custos em `supplierCost` são USD: `fromCents` é o custo de catálogo a partir de e `variantCents` é o custo do SKU selecionado. Não incluem tributos, câmbio ou taxas. `shippingEstimate` registra uma estimativa por produto e país, em USD; não é cotação final por SKU, CEP ou pedido completo. Não foi convertida em regra de frete contratado.

Todas as variantes consultadas estão disponíveis no fornecedor sem contagem de unidades. `supplierInventory` conserva `available: null` e `tracked: false`; nenhum estoque foi inventado. O modo `supplier_availability` aceita apenas uma consulta positiva recente, SKU e variante identificados, com limite de 10 unidades por item no pedido. A contagem controlada continua com reserva local concorrente. Para disponibilidade sem contagem, o ledger registra o pedido, sem alegar reserva no fornecedor. A vitrine mostra `pricingDraft` com total previsto e frete estimado incluído. A previsão usa o custo da variante escolhida, frete por produto para Brasil e câmbio de referência BCE de 16/10/2026; a fórmula e suas despesas excluídas constam em `pricingPolicy` e `docs/fornecimento.md`. `npm run price:preview` reproduz a previsão, sem atualizar o câmbio nem os preços de cobrança. Preço final e aprovação comercial seguem obrigatórios: os 30 produtos permanecem com `supplierApproved: false`, `availability: pending_launch` e `priceCents: null`.

As 30 fotos reais foram baixadas pelo navegador a partir dos URLs do catálogo e são servidas pela própria DAVORA em `assets/products/`, sem depender de requisições ao CDN Zendrop no navegador do cliente. O catálogo preserva `sourceImageUrl`, `imageVerifiedAt` e `imageSha256`; os bytes originais das imagens foram conservados. A CSP não precisa mais permitir o host externo de imagens Zendrop. As marcas citadas identificam produtos ou aparelhos compatíveis. O uso comercial das imagens e as especificações exatas devem ser confirmados antes do lançamento. Dados de estoque ou disponibilidade só são aceitos se consultados há menos de 24 horas.

A conexão do app Zendrop ao ChatGPT permite consultar catálogo, variações, disponibilidade e frete, além de gerenciar pedidos que já existem nas lojas conectadas. Essa autorização não instala um serviço permanente no servidor da DAVORA. As ferramentas disponíveis não incluem criação de pedidos externos nem conexão de uma loja GitHub/Vercel. A única loja vinculada continua sendo a Wix de referência, que não foi alterada. `supplierConnection.status` está `connected` para as ferramentas do assistente; `fulfillmentIntegration.status` continua `not_connected` para a loja. Fontes e dados estão em `docs/fornecimento.md`.

## Hospedagem e situação da publicação

O repositório pode continuar no GitHub. **GitHub Pages não permite hospedar uma operação de comércio eletrônico**, conforme https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits . O código usa funções Node para a parte de pagamento e precisa de hospedagem compatível, com plano que permita uso comercial.

O projeto Vercel é `davora`, ID `prj_pkUMXGi8V0YpztNbJUUegJQc0EoT`. A branch de trabalho continua sendo `codex/davora-brasil-20261015`. A integração GitHub–Vercel gera a prévia em https://davora-git-codex-davora-brasil-20261015-davidsonroberto.vercel.app . A consulta ao projeto funciona sem o parâmetro de escopo que retorna 403; o ID do projeto identifica o destino exato.

Na consulta de 16/10/2026, a configuração **production** contém `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, gerenciadas pela integração Stripe–Vercel. Foram consultados somente nomes e metadados, sem descriptografar valores. O ambiente das credenciais não foi inferido a partir do nome **production**: essa é a configuração da hospedagem, não uma prova de chave Stripe live. As chaves não estão disponíveis na prévia, o que é compatível com a manutenção das compras desativadas.

O login no painel Vercel foi concluído. O token Blob de preparação foi convertido em variável sensível e restringido a preview, sem ler ou substituir seu valor. O novo escopo não revoga cópias de deploys antigos. A verificação do endpoint remoto ainda não foi concluída: este navegador retornou `net::ERR_BLOCKED_BY_CLIENT`. O painel indica plano Hobby; a [política de uso da Vercel](https://vercel.com/docs/limits/fair-use-guidelines) exige Pro ou Enterprise para operação comercial. Nenhuma assinatura paga foi contratada. Detalhes e próximos requisitos estão em `docs/pedidos.md`.

## Dependências antes de vender

1. Concluir o fluxo de fornecimento Zendrop compatível com a DAVORA. A conta está conectada à Wix de referência, que não foi alterada. A loja GitHub/Vercel não tem integração direta confirmada; definir um backend suportado ou um fluxo manual aceito antes de vender. SKUs, custos e disponibilidade foram consultados; concluir o fluxo de envio e a revisão comercial das fotos e especificações.
2. Confirmar envio e custo por variante e por pedido completo para o Brasil, incluindo processamento, rastreio e tributos. A média de transporte mostrada para um produto não é uma promessa para os demais. Não há frete grátis presumido.
3. Definir preços em `priceCents`, em centavos. Margem de 50% antes das demais despesas exige preço de venda igual a duas vezes o custo considerado; taxas, frete subsidiado, impostos, anúncios e devoluções diminuem o lucro. Fazer a conta com custos reais antes de escolher o preço.
4. Conectar a hospedagem à Stripe por configuração segura do servidor. A conexão do ChatGPT foi verificada em 15/10/2026: conta brasileira em BRL, somente ambiente de teste disponível nesta sessão, cartões habilitados e sem exigências cadastrais pendentes na consulta. Isso não comprova a ativação da conta de produção. As três variáveis de credenciais foram cadastradas na configuração production da Vercel; valores e ambiente Stripe não foram inspecionados. Nenhuma chave deve ser enviada por mensagem ou incluída no GitHub.
5. Completar identificação comercial da loja, condições de entrega, atendimento, privacidade, trocas e devoluções com dados reais do responsável.
6. Validar remotamente o registro durável e a reserva de estoque implementados em `lib/orders.js`, registrar e verificar o webhook Stripe e preparar a rotina de repasse ao fornecedor. O Blob privado foi provisionado e as chaves da preparação foram configuradas na Vercel. A implementação, os limites e as pendências estão em `docs/pedidos.md`. Não há reserva no estoque do fornecedor nem despacho automático. A retomada temporária na aba não substitui o acompanhamento operacional dos pedidos.
7. Testar compra, atualização de estoque, cobrança repetida, indisponibilidade, expiração, reembolso, registro do pedido e despacho em ambiente de teste antes de liberar vendas reais.

Depois destas etapas, a ativação exige todas as condições de `lib/store.js`, configurações explícitas de `.env.example`, produtos autorizados e preços/estoques confirmados. **Não ativar só preenchendo variáveis: o sistema de pedidos e as condições acima ainda precisam ser concluídos.**

`DAVORA_SHIPPING_RULES` aceita uma lista de regras por pedido completo com `cepStart` e `cepEnd` (8 dígitos), `priceCents` (inteiro) e `days` (inteiro). Faixas conflitantes são recusadas; não há taxa ou prazo de frete inventado como padrão.

## Verificação

Node 22 ou superior. Instalar as dependências com `npm ci`; as versões de `@vercel/blob` e `stripe` estão fixadas no lockfile. Stripe.js é carregado diretamente de https://js.stripe.com/endive/stripe.js ao abrir um pagamento, e a API usa a versão 2026-09-30.endive.

```sh
npm test
npm run check
git diff --check
```

Os 32 testes exercitam bloqueio de produtos pendentes, adulteração de preço/frete, estoque vencido, limites de quantidade, idempotência inclusive em repetições após atraso, configuração de Pix, separação teste/produção, chave publicável gerenciada pela Vercel, confirmação autoritativa, retomada da mesma sessão aberta e recusa do webhook antigo. A recuperação rejeita tokens adulterados ou expirados, divergência de valor/ambiente/referência, e não retorna formulário para pagamento já concluído. O armazenamento na aba exclui dados pessoais e client secret. As chamadas à Stripe são simuladas; nenhuma cobrança foi realizada. A conferência local em Chromium verificou 30 cartões, cinco categorias, busca sem acentos, detalhes, seleção persistida, bloqueio do pagamento e ausência de rolagem horizontal na página em celular. As 30 imagens foram baixadas no navegador, verificadas como PNG/JPEG válidos e copiadas sem alteração para os arquivos do site. A validação confere a existência e o SHA-256 de cada foto. O carregamento por solicitações diretas ao CDN retornou HTTP 403 antes dessa alteração; a vitrine agora usa os arquivos locais. A consulta pontual ao fornecedor e as estimativas por produto/país estão registradas; falta seleção do SKU na loja, controle operacional e cotação final por pedido.

Documentação do pagamento:
- https://docs.stripe.com/checkout/embedded/quickstart
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/google-pay?platform=web
- https://docs.stripe.com/payments/pix
- https://docs.stripe.com/api/versioning

Os endpoints antigos de currículo, consulta de pagamento e webhook estão desativados (HTTP 410). A loja não usa Mercado Pago. O webhook antigo recusa notificações e não deve ser cadastrado como destino. O webhook Stripe em `/api/stripe-webhook` foi implementado com verificação de assinatura e processamento idempotente; registrar o endpoint e testar a entrega é obrigatório antes do lançamento: tratar `checkout.session.completed` e `checkout.session.async_payment_succeeded` somente com `payment_status: paid`, além das falhas assíncronas. O registro privado e as reservas foram implementados; a verificação remota, a configuração do webhook e o repasse ao fornecedor permanecem pendentes antes de vendas reais.


## Ativação da Stripe

- `STRIPE_SECRET_KEY`: preferir chave restrita (`rk_`) com as permissões mínimas necessárias, somente no servidor, em variável sensível da Vercel. Não enviar por mensagem nem incluir no repositório.
- `STRIPE_PUBLISHABLE_KEY`: chave publicável correspondente ao mesmo ambiente de teste ou produção. Também aceita `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, nome fornecido pela integração nativa Stripe–Vercel. Se ambos estiverem preenchidos, o primeiro tem prioridade.
- Conexão gerenciada: https://vercel.com/marketplace/stripe . Para uma conta já existente, escolher **Install → Import Existing Stripe Account**, concluir o login/consentimento na Stripe e conectar o recurso ao projeto **davora**. A integração entrega as chaves à Vercel sem copiá-las por mensagem. Uma nova publicação é necessária para usar as variáveis. Importar a conta não autoriza ativar as compras antes de concluir os requisitos comerciais e de pedidos.
- `STRIPE_PIX_ENABLED`: permanece `false` até verificar a elegibilidade e ativar Pix nesta conta.
- Cadastrar o domínio definitivo e os domínios de teste usados para Google Pay em https://dashboard.stripe.com/settings/payment_method_domains . Ativar as formas de pagamento desejadas na conta. O botão Google Pay só aparece quando os requisitos de conta, domínio, navegador e carteira são atendidos.
- Na consulta ao ambiente de teste em 15/10/2026, Google Pay e Pix estavam indisponíveis na configuração padrão e não havia domínios cadastrados. Nenhuma forma de pagamento ou configuração da conta foi alterada nesta verificação.
- A sugestão de adicionar a Stripe ao ChatGPT permite autorizar a conexão à conta; isso não transfere credenciais secretas para a hospedagem nem ativa o site automaticamente.
- A sessão usa `ui_mode: embedded_page`, `redirect_on_completion: never` e somente as formas permitidas por `allowed_payment_method_types`. A confirmação exibida pela loja depende da consulta ao servidor e exige `status: complete` e `payment_status: paid`, com valor, moeda, referência e ambiente compatíveis.
- A expiração deriva da cotação assinada para manter o corpo da requisição idêntico nas repetições com a mesma chave idempotente. `integration_identifier` identifica este fluxo no painel Stripe. A configuração Vercel inclui uma política de segurança de conteúdo compatível com Stripe.js e Checkout embutido.
- As chaves foram cadastradas anteriormente pelo usuário na integração nativa da Vercel. Esta alteração não lê nem altera credenciais e não cria sessões reais de pagamento. Manter compras bloqueadas até concluir as dependências comerciais e operacionais acima.
