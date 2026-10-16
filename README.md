# DAVORA Brasil

Versão de preparação de 16/10/2026, em português e BRL, com foco em eletrônicos e acessórios para o Brasil. Conserva as cores e a estrutura visual da DAVORA do GitHub. A vitrine reúne 24 acessórios reais encontrados no catálogo público da Infinito Loja: cabos, carregadores, capinhas, películas, pulseiras e acessórios de uso diário. Não há parceria ou disponibilidade comercial confirmada.

## O que funciona

- Busca por nome, marca ou categoria, inclusive sem acentos.
- Fotos dos produtos, detalhes, seleção de itens, quantidades e remoção.
- Seleção persistida no navegador; dados pessoais não são guardados no localStorage.
- Formulário de entrega e Stripe Checkout embutido na própria página, condicionado à ativação do servidor. Cartões e Google Pay dependem da conta/dispositivo; Pix só é incluído quando habilitado explicitamente.
- APIs de cotação assinada, criação idempotente de sessão Stripe Checkout e consulta autoritativa do pagamento na Stripe. Valores são calculados no servidor, nunca aceitos do navegador.

**As compras estão desativadas.** Produtos identificados em catálogos públicos não equivalem a acordo de fornecimento. Preços de revenda, variantes, estoque e regras comerciais ainda dependem do cadastro e da confirmação do fornecedor. Não houve contratação, importação para uma conta de lojista, pagamento nem pedido ao fornecedor. Não há comissão garantida de 50%.

## Catálogo e origem das fotos

`data/catalog.json` registra SKU de referência, nome de origem, URL do produto, foto pública e observações de compatibilidade. Os nomes de aparelhos indicam compatibilidade; os acessórios não são anunciados como originais das fabricantes. Fotos e especificações deverão ser aprovadas para o uso comercial antes do lançamento. Opções de cor, medida, modelo e comprimento não são tratadas como variantes compráveis antes da confirmação do SKU exato.

- https://app.dropi.com.br/marketplace/fornecedor/infinitoLoja
- https://infinitoloja.com.br/atacado

A presença do fornecedor no Dropi não comprova integração direta com Vercel nem aceite de pedidos manuais fora do Dropi. A pesquisa das alternativas e as perguntas comerciais pendentes estão em `docs/fornecimento.md`.

Cada produto está com `supplierApproved: false`, `availability: pending_confirmation`, `priceCents: null`, `stock: null`. Fotos são carregadas do CDN de origem. Estoque anunciado só é aceito se confirmado há menos de 24 horas.

## Hospedagem e situação da publicação

O repositório pode continuar no GitHub. **GitHub Pages não permite hospedar uma operação de comércio eletrônico**, conforme https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits . O código usa funções Node para a parte de pagamento e precisa de hospedagem compatível, com plano que permita uso comercial.

O projeto Vercel é `davora`, ID `prj_pkUMXGi8V0YpztNbJUUegJQc0EoT`. A branch de trabalho continua sendo `codex/davora-brasil-20261015`. A integração GitHub–Vercel gera a prévia em https://davora-git-codex-davora-brasil-20261015-davidsonroberto.vercel.app . A consulta ao projeto funciona sem o parâmetro de escopo que retorna 403; o ID do projeto identifica o destino exato.

Na consulta de 16/10/2026, a configuração **production** contém `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, gerenciadas pela integração Stripe–Vercel. Foram consultados somente nomes e metadados, sem descriptografar valores. O ambiente das credenciais não foi inferido a partir do nome **production**: essa é a configuração da hospedagem, não uma prova de chave Stripe live. As chaves não estão disponíveis na prévia, o que é compatível com a manutenção das compras desativadas.

## Dependências antes de vender

1. Confirmar se a Infinito Loja atende à DAVORA por pedido manual com envio direto ao cliente fora do Dropi, quais documentos exige e quais são os custos. Se não atender, escolher outro fornecedor antes de ativar qualquer produto. Obter autorização comercial e de uso das fotos, com SKU exato, modelo, cor, medida, quantidade, custo e estoque.
2. Confirmar frete e prazo por pedido completo, inclusive pedidos com fornecedores diferentes. Não copiar custos do AliExpress antigo.
3. Definir preços em `priceCents`, em centavos. Margem de 50% antes das demais despesas exige preço de venda igual a duas vezes o custo considerado; taxas, frete subsidiado, impostos, anúncios e devoluções diminuem o lucro. Fazer a conta com custos reais antes de escolher o preço.
4. Conectar a hospedagem à Stripe por configuração segura do servidor. A conexão do ChatGPT foi verificada em 15/10/2026: conta brasileira em BRL, somente ambiente de teste disponível nesta sessão, cartões habilitados e sem exigências cadastrais pendentes na consulta. Isso não comprova a ativação da conta de produção. As três variáveis de credenciais foram cadastradas na configuração production da Vercel; valores e ambiente Stripe não foram inspecionados. Nenhuma chave deve ser enviada por mensagem ou incluída no GitHub.
5. Completar identificação comercial da loja, condições de entrega, atendimento, privacidade, trocas e devoluções com dados reais do responsável.
6. Integrar registro durável de pedidos, acompanhamento/recuperação de pagamento, controle de estoque e rotina de repasse ao fornecedor. Esta versão **não** envia pedidos automaticamente ao fornecedor nem reserva/decrementa estoque. As APIs são uma base de integração; não representam um sistema de pedidos concluído.
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

Os 15 testes exercitam bloqueio de produtos pendentes, adulteração de preço/frete, estoque vencido, limites de quantidade, idempotência inclusive em repetições após atraso, configuração de Pix, separação teste/produção, chave publicável gerenciada pela Vercel, confirmação autoritativa e recusa do webhook antigo. A chamada à Stripe é simulada; nenhuma cobrança foi realizada. A conferência da atualização de catálogo deve incluir o carregamento das 24 fotos e o fluxo de busca, filtros, detalhes e seleção em telas de computador e celular.

Documentação do pagamento:
- https://docs.stripe.com/checkout/embedded/quickstart
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/google-pay?platform=web
- https://docs.stripe.com/payments/pix
- https://docs.stripe.com/api/versioning

Os endpoints antigos de currículo, consulta de pagamento e webhook estão desativados (HTTP 410). A loja não usa Mercado Pago. O webhook antigo recusa notificações e não deve ser cadastrado como destino. Um webhook Stripe com verificação de assinatura e processamento idempotente é obrigatório antes do lançamento: tratar `checkout.session.completed` e `checkout.session.async_payment_succeeded` somente com `payment_status: paid`, além das falhas assíncronas. O registro durável de pedidos, recuperação de sessão e repasse ao fornecedor também permanecem pendentes antes de vendas reais.


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
