# Integração DAVORA Brasil → Wix → Zendrop

## Estado atual

O proprietário autorizou usar sua Wix existente como sistema de pedidos e esclareceu que a vitrine `davora.app` é sua outra loja em inglês. A vitrine brasileira continua no repositório/Vercel, em português e BRL. A consulta Wix identificou idioma `en` e moeda de cobrança `BRL`; essas propriedades não foram alteradas.

Foi criado o cliente OAuth `DAVORA Brasil - pedidos`, ID público `b71b81f1-6b07-4c93-a555-63200812560f`, ligado somente ao site Wix `d8b1d97c-b1cf-4548-8dae-3c9f70ec2baa`. A loja conectada na Zendrop é `3668910`. Um cliente OAuth público não equivale à autorização administrativa do servidor: a chave privada ainda falta.

A continuidade da integração foi solicitada novamente pelo proprietário. A criação dos 30 cadastros internos está preparada em `docs/wix-catalog-plan.json`, com revisão dos valores em `docs/precos-brasil-revisao.md`; aguarda aceitação explícita dos preços provisórios, exigida pelo fluxo Catalog V3 antes de criar produtos. Nenhum dos 30 produtos foi criado, importado ou vinculado. Os produtos existentes, a vitrine, idioma, moeda e configurações de despacho da loja em inglês foram preservados. Os cadastros destinados à integração devem começar ocultos e indisponíveis.

## Código preparado

- `lib/wix-orders.js` troca as credenciais privadas do cliente por token temporário, cria um pedido Wix em BRL após pagamento confirmado e registra a transação Stripe existente. Não realiza nova cobrança nem compra na Zendrop.
- O webhook primeiro verifica assinatura, ambiente e pagamento diretamente na Stripe. O registro durável confere referência, valor e fingerprint antes do envio à Wix.
- Cada cotação conserva os IDs Wix e o SKU canônico do servidor. Uma troca posterior de produto/variante invalida a cotação.
- Uma reserva atômica de sincronização impede que webhooks concorrentes criem o mesmo pedido duas vezes. Se o resultado remoto for incerto, o pedido fica para conferência; não há repetição cega da criação ou do registro de pagamento.
- Endereço de entrega brasileiro e CPF seguem no campo nativo `contactDetails.vatId: {type: 'CPF', id: ...}`. O CPF também identifica o campo do pedido para conferência. Nenhum dado pessoal entra no catálogo público.
- Notificações da criação administrativa ficam desativadas para evitar mensagens duplicadas. A conta Stripe permanece responsável por cobrança e eventuais reembolsos.
- Registrar o pagamento na Wix é diferente de comprovar a entrada do pedido na Zendrop. O estado `sent_to_wix` não afirma que houve compra, despacho ou rastreio no fornecedor.

## Condições antes de ativar

1. Obter aceitação dos 30 valores provisórios apresentados em `docs/precos-brasil-revisao.md`. O lote usa os preços previstos do catálogo e cria somente registros ocultos e indisponíveis, sem prometer disponibilidade comercial. A Wix existente usa Catalog V3; não chamar endpoints V1.
2. Criar e vincular os produtos, preservando um único SKU selecionado por item. Registrar `fulfillmentMapping` com `provider`, `siteId`, `productId`, `variantId`, `zendropLinked`, `supplierSku` e `supplierVariantId`. Nunca mapear variantes por posição ou por menor preço.
3. Gerar a chave do cliente nas configurações Headless da Wix e guardá-la como `WIX_CLIENT_SECRET` nas variáveis protegidas do servidor. Não colocar a chave em chat, repositório, HTML ou catálogo. `WIX_CLIENT_ID` é público; a chave privada não é retornada pela API de clientes.
4. Validar autorização, recebimento do pedido na Wix, moeda/valores/CPF/endereço e criação correspondente na Zendrop. Pedidos de teste Stripe são bloqueados para a loja real, salvo habilitação específica de `DAVORA_WIX_ALLOW_TEST_ORDERS` em ambiente de revisão. Não simular recebimento de dinheiro real.
5. Somente após a validação, configurar `DAVORA_WIX_ORDERS_ENABLED=true` e `DAVORA_WIX_ORDERS_VERIFIED=true`, além dos demais requisitos de pagamento, frete, disponibilidade recente e revisão comercial. Todos continuam desativados nesta entrega.

As quatro variáveis não secretas da integração foram preparadas somente para o preview da branch da DAVORA Brasil. `enabled`, `verified` e `allow test orders` ficam `false`. `/api/fulfillment-config` mostra somente estado de configuração e contagem dos vínculos; não revela credenciais e não prova uma conexão remota por si só.

A API Create Order informa limite de cinco chamadas por hora/site para apps ainda não publicados no App Market. A aplicação dessa limitação ao cliente Headless precisa ser confirmada no teste real; não prometer escala sem verificá-la. A configuração de auto-fulfillment da Zendrop permanece desligada. Ativá-la globalmente também afetaria a loja em inglês e poderia gerar cobranças, por isso não faz parte desta preparação.

## Fontes oficiais

- Cliente Headless: https://www.wix.com/skills/wix-manage/references/sites/manage-oauth-apps.md
- Autorização administrativa: https://dev.wix.com/docs/go-headless/authentication/admin/make-admin-api-calls-with-client-credentials
- Token: https://dev.wix.com/docs/api-reference/app-management/oauth-2/create-access-token
- Criar pedido: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/orders/create-order
- Registrar pagamento existente: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/order-transactions/add-payments

Os testes automatizados usam Stripe/Wix e armazenamento simulados; a validação real continua pendente.

## Continuidade de configuração em 20/10/2026

- Painel Wix acessível, site e versão V3 confirmados. Nenhum produto desta integração foi criado ou vinculado.
- A conta Zendrop informa plano por uso de até 500 produtos por US$ 29/mês. Nenhum upgrade foi solicitado. Não há forma de pagamento de fornecimento cadastrada.
- A Stripe exige login adicional para acessar produção. A entrada segura ofereceu Google; a inspeção da tela seguinte foi bloqueada pela revisão automática por falta de autorização de uma conta Google específica.
- A revisão automática também rejeitou abrir e capturar a página de credenciais OAuth porque o snapshot poderia expor o segredo. Nenhum segredo foi obtido. Retomar apenas com autorização adequada e leitura restrita, ou com o proprietário configurando a credencial diretamente no campo protegido da hospedagem.
- Os bloqueios de revisão não foram contornados. Checkout, envio à Wix e compras de fornecedor seguem desativados.
