# Fornecimento Zendrop para DAVORA Brasil

Seleção de 16/10/2026: 30 produtos consultados no catálogo autenticado da Zendrop, com foco em eletrônicos e acessórios. A vitrine é a DAVORA do repositório GitHub/Vercel, em português e BRL. A `davora.app` na Wix foi usada como referência e não foi alterada.

## O que foi confirmado

A conta Zendrop estava conectada à loja Wix de referência. A consulta foi somente de leitura: não houve importação para a Wix, pedido de amostra, cobrança, assinatura ou aceite de contrato.

Os 30 produtos têm ID, URL individual, nome de origem, foto e custo a partir de em USD registrados no catálogo. Distribuição: 8 itens de áudio, 6 de cabos e carga, 11 de capas/proteção, 3 pulseiras e 2 itens de mesa/setup. O custo USD é do produto no catálogo, sem frete, tributos, câmbio ou confirmação da variante. Não é comissão nem preço de revenda. As URLs de foto foram extraídas do DOM dos respectivos cartões. O CDN retornou HTTP 403 na conferência local; o carregamento externo das fotos ainda não foi validado e não deve ser descrito como concluído.

No produto 2932951 (suporte de headset), foi possível selecionar Brazil. A tela apresentou média de envio de 21 days e custo de produto de US$ 3,44. Não informou custo de frete confirmado. Esses dados não foram aplicados aos outros produtos nem tratados como prazo contratual. A consulta de Todos os SKUs abriu uma verificação Cloudflare que permaneceu bloqueando este navegador; não foi tentado contornar o bloqueio. SKU, estoque e cotação por variante ficaram pendentes.

## Integração e envio

A Zendrop documenta integrações nativas com Shopify, TikTok Shop US, ClickFunnels e Wix. Não há integração direta GitHub/Vercel implementada nem API pública confirmada para usar nesta loja. Solicitar uma integração é uma proposta de recurso, não uma conexão pronta.

A documentação de pedidos externos descreve um fluxo manual de pedido de amostra com plano pago e conexão a plataforma suportada. Não é uma automação gratuita e não autoriza presumir que a conexão Wix existente atenda a esse fluxo. Nenhum plano foi contratado.

A Zendrop documenta envio ao Brasil e necessidade de CPF/CNPJ do destinatário. Frete e tributos de importação não devem ser presumidos como incluídos. A média geral publicada para o país não substitui a cotação e as condições do SKU escolhido.

Fontes oficiais consultadas:

- Integrações: https://support.zendrop.com/en/articles/8176418-zendrop-e-commerce-platform-integrations
- Solicitação de novas integrações: https://support.zendrop.com/en/articles/12582165-requesting-new-store-integrations-on-zendrop
- Pedidos externos: https://support.zendrop.com/en/articles/8176420-how-to-fulfill-orders-received-outside-of-zendrop
- Requisitos internacionais: https://support.zendrop.com/en/articles/9492634-international-shipping-considerations-with-zendrop
- Médias de transporte por país: https://support.zendrop.com/en/articles/8487356-zendrop-shipping-times-by-country
- Tributos e alfândega: https://support.zendrop.com/en/articles/16100468-how-do-tariffs-and-customs-duties-affect-my-zendrop-orders

## Preço e lançamento

A DAVORA mantém as compras desativadas. Cada produto depende de SKU exato, custo total, estoque, condições de uso das fotos e envio ao Brasil confirmados. O repasse de pedidos precisa de um fluxo operacional compatível e testado antes da primeira venda.

O preço de revenda é uma decisão da DAVORA. Margem de 50% sobre a receita antes das demais despesas exige vender por duas vezes o custo considerado; taxas, câmbio, frete subsidiado, tributos, anúncios e devoluções reduzem o lucro. Não há percentual garantido pela Zendrop.

Além do fornecimento, continuam pendentes a verificação remota do registro durável de pedidos, configuração e entrega do webhook Stripe e dados comerciais da loja. Consulte `docs/pedidos.md`. A alteração de catálogo não libera o checkout nem faz pagamentos ao fornecedor.

## Produtos selecionados

| ID Zendrop | Produto na DAVORA | Custo de catálogo a partir de (USD) |
| --- | --- | ---: |
| 2932951 | Suporte de mesa para headset | 3.44 |
| 2933013 | Relógio digital RGB de mesa | 24.43 |
| 2932911 | Caixa de som retrô AS19 | 16.98 |
| 2937460 | Headset gamer NUBWO N7 com fio | 13.94 |
| 2933186 | Fones sem fio TWS F9-5C | 2.49 |
| 2932754 | Fones sem fio S109 | 0.96 |
| 2932497 | Fones TWS de condução aérea | 7.43 |
| 2931956 | Fones sem fio esportivos | 3.99 |
| 2933399 | Fones com fio Patinha Rosa | 0.65 |
| 2933398 | Fones gamer sem fio com toque | 7.82 |
| 2932823 | Cabo USB-C HOCO X20 | 0.84 |
| 2932584 | Cabo de recarga multiuso | 1.13 |
| 2932750 | Cabo chaveiro 4 em 1 USB-C | 4.39 |
| 2932749 | Carregador magnético 4 em 1 | 20.57 |
| 2932570 | Suporte carregador veicular A7 | 5.73 |
| 2938549 | Kit carregador com duas portas USB-C | 7.63 |
| 2938582 | Capa com brilho e apoio para iPhone | 2.49 |
| 2935811 | Capa Armor com moldura para iPhone | 5.35 |
| 2933219 | Capa rígida com apoio para iPhone | 0.96 |
| 2933383 | Porta-cartões magnético para iPhone | 3.20 |
| 2932605 | Capa transparente para Galaxy | 0.52 |
| 2932448 | Capa fosca em acrílico para Galaxy | 1.43 |
| 2931926 | Capa magnética para Galaxy | 1.51 |
| 2935810 | Capa com anel de apoio para Galaxy | 1.43 |
| 2932821 | Capa texturizada para Galaxy | 3.25 |
| 2933334 | Pulseira milanesa magnética | 1.03 |
| 2933285 | Pulseira milanesa com fivela | 0.86 |
| 2932579 | Pulseira de elos em aço | 4.77 |
| 2932310 | Capa transparente para estojo de fones | 0.23 |
| 2933400 | Capa floral para estojo de fones | 2.49 |
