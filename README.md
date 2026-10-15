# DAVORA Brasil

Versão de preparação de 15/10/2026, em português e BRL. Conserva as cores e a estrutura visual da DAVORA do GitHub e substitui a vitrine incompleta de afiliados por 16 produtos reais de beleza.

## O que funciona

- Busca por nome, marca ou categoria, inclusive sem acentos.
- Fotos dos produtos, detalhes, seleção de itens, quantidades e remoção.
- Seleção persistida no navegador; dados pessoais não são guardados no localStorage.
- Formulário de entrega e fluxo de Pix na própria página, condicionado à ativação do servidor.
- APIs de cotação assinada, criação idempotente de Pix e consulta do status no Mercado Pago. Valores são calculados no servidor, nunca aceitos do navegador.

**As compras estão desativadas.** Produtos identificados em catálogos públicos não equivalem a acordo de fornecimento. Preços de revenda, estoque e regras comerciais são ocultos sem acesso à conta Dropi. Não houve contratação, importação para uma conta de lojista, pagamento nem pedido ao fornecedor. Não há comissão garantida de 50%.

## Catálogo e origem das fotos

`data/catalog.json` registra marca, SKU, referência do produto e imagem pública de cada item. Foram selecionados produtos Bitarra Beauty e Vitamédica dos catálogos públicos abaixo, consultados em 15/10/2026. As descrições são curtas e sem promessas terapêuticas.

- https://app.dropi.com.br/marketplace/fornecedor/bitarra-beauty
- https://app.dropi.com.br/marketplace/fornecedor/vitamedica
- https://dropi.sak.com.br/como-funciona-o-dropnacional

Cada produto está com `supplierApproved: false`, `availability: pending_confirmation`, `priceCents: null`, `stock: null`. Fotos são carregadas do CDN de origem. Estoque anunciado só é aceito se confirmado há menos de 24 horas.

## Hospedagem e situação da publicação

O repositório pode continuar no GitHub. **GitHub Pages não permite hospedar uma operação de comércio eletrônico**, conforme https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits . O código usa funções Node para a parte de pagamento e precisa de hospedagem compatível, com plano que permita uso comercial.

O projeto Vercel `davora` foi localizado, mas a consulta detalhada retornou 403 por falta de acesso ao escopo da conta. Não foi possível publicar ou verificar suas configurações. O Opera também retornou navegador desconectado. Nenhum domínio foi alterado.

## Dependências antes de vender

1. Acessar a conta Dropi/DropNacional e obter a autorização de revenda dos fornecedores, confirmando SKU, cor, quantidade, custo, estoque e uso de fotos.
2. Confirmar frete e prazo por pedido completo, inclusive pedidos com fornecedores diferentes. Não copiar custos do AliExpress antigo.
3. Definir preços em `priceCents`, em centavos. Margem de 50% antes das demais despesas exige preço de venda igual a duas vezes o custo considerado; taxas, frete subsidiado, impostos, anúncios e devoluções diminuem o lucro. Fazer a conta com custos reais antes de escolher o preço.
4. Conectar a hospedagem e o Mercado Pago por configuração segura do servidor. Nenhuma chave deve ser enviada por mensagem ou incluída no GitHub.
5. Completar identificação comercial da loja, condições de entrega, atendimento, privacidade, trocas e devoluções com dados reais do responsável.
6. Integrar registro durável de pedidos, acompanhamento/recuperação de pagamento, controle de estoque e rotina de repasse ao fornecedor. Esta versão **não** envia pedidos automaticamente ao Dropi nem reserva/decrementa estoque. As APIs são uma base de integração; não representam um sistema de pedidos concluído.
7. Testar compra, atualização de estoque, cobrança repetida, indisponibilidade, expiração, reembolso, registro do pedido e despacho em ambiente de teste antes de liberar vendas reais.

Depois destas etapas, a ativação exige todas as condições de `lib/store.js`, configurações explícitas de `.env.example`, produtos autorizados e preços/estoques confirmados. **Não ativar só preenchendo variáveis: o sistema de pedidos e as condições acima ainda precisam ser concluídos.**

`DAVORA_SHIPPING_RULES` aceita uma lista de regras por pedido completo com `cepStart` e `cepEnd` (8 dígitos), `priceCents` (inteiro) e `days` (inteiro). Faixas conflitantes são recusadas; não há taxa ou prazo de frete inventado como padrão.

## Verificação

Node 22 ou superior. Sem dependências externas para a aplicação.

```sh
npm test
npm run check
git diff --check
```

Os testes exercitam bloqueio de produtos pendentes, adulteração de preço/frete, estoque vencido, limites de quantidade, idempotência e confirmação autoritativa. A chamada ao Mercado Pago é simulada; nenhuma cobrança foi realizada. As 16 imagens retornaram HTTP 200 na conferência de 15/10/2026. Sem teste visual em navegador nesta sessão.

Documentação do pagamento:
- https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix
- https://www.mercadopago.com.br/developers/en/reference/online-payments/subscriptions/create-payment/post

Os arquivos antigos de currículo (`api/create-preference.js` e companhia) não são usados por esta vitrine. O checkout de currículo permanece desativado.
