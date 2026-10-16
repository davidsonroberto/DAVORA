# Fornecimento Zendrop para DAVORA Brasil

Consulta oficial concluída em 16/10/2026: 30 produtos, 2.082 variantes e 30 estimativas de frete para o Brasil. A vitrine é a DAVORA do GitHub/Vercel. A Wix `davora.app` é outra loja do proprietário, em inglês. O usuário autorizou avaliar seu uso como backend da DAVORA Brasil. Foi criado um cliente de integração exclusivo; nenhum produto foi criado ou alterado nela.

## Dados confirmados

A autorização do app Zendrop funcionou. A consulta completa incluiu todas as páginas de variantes e conservou os valores originais de disponibilidade, custo e transporte para revisão local. O arquivo completo não integra a publicação da vitrine; o catálogo publicado contém apenas os 30 modelos selecionados. A vitrine escolhe um SKU por produto, com modelo e cor em português. A seleção de cabo HOCO usa USB-C de 1 m, e não o custo menor do cabo Micro-USB; a pulseira com fivela usa o encaixe Apple Watch escolhido, e não o encaixe genérico de 20 mm. O relógio informa montagem necessária; o kit USB-C informa as quatro peças da variante selecionada.

Os 30 SKUs selecionados estavam disponíveis, mas a Zendrop não controla uma contagem numérica para eles: `available` é `null`, `tracked` é `false` e o status é `In stock`. Não interpretar `null` como zero nem fabricar uma quantidade. O código diferencia essa disponibilidade do estoque com contagem. A consulta expira em 24 horas para fins de aceitação de pedidos, e não é uma reserva no fornecedor.

As 30 fotos reais são arquivos locais em `assets/products/`, com origem e SHA-256 conservados. As fotos são ilustrativas das variações do catálogo; o modelo e a cor da seleção são informados no produto.

## Frete e preço

O frete retornado pelo app é uma **estimativa por produto e país**, em USD. Não existe parâmetro de variante, quantidade, CEP ou endereço nesta ferramenta. Portanto, estes valores não foram usados como regra contratada de frete nem como custo final de um carrinho. Os valores retornados variam de US$ 12,49 a US$ 30,84. Todas as consultas retornaram o texto original `21 days`; isso não foi convertido em prazo garantido nem em dias úteis.

Produto mais frete estimado ainda não inclui tributos, conversão cambial, processador de pagamento, publicidade, devoluções ou mensalidades. Frete grátis ao consumidor teria de ser custeado pela DAVORA e incorporado ao preço. A Zendrop não promete comissão de 50%. Preço de venda igual a duas vezes o custo considerado representa margem de 50% antes das despesas excluídas, sem garantia de lucro líquido.

Foram preenchidos preços **previstos em BRL para os 30 produtos**, com frete estimado por unidade incluído na previsão. O câmbio de orçamento usa a referência do Banco Central Europeu de 16/10/2026: EUR/USD 1,1253 e EUR/BRL 5,7197, equivalentes a USD/BRL = 5,7197 ÷ 1,1253. É referência informativa, não taxa de liquidação do cartão. Fonte: https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html .

A fórmula é `(custo USD do SKU selecionado + frete USD estimado para Brasil) × câmbio ÷ (1 − 0,50)`, arredondada para cima ao próximo preço terminado em R$ 0,90. O cálculo usa inteiros e razão cambial exata; não usa o menor preço de outra variante. A meta é margem bruta de pelo menos 50% sobre os dois custos considerados, antes das despesas excluídas acima. Os preços elevados de frete tornam alguns acessórios caros; isso não constitui validação de competitividade ou rentabilidade.

`pricingPolicy` registra a origem e as premissas. Cada `pricingDraft` contém o total previsto e a referência de frete incluída, com escopo de uma unidade e país. Somar essas previsões na seleção não calcula frete consolidado por pedido. A vitrine identifica preço e prazo como estimativas e informa que processamento, alfândega e tributos dependem de confirmação. `priceCents` permanece nulo; não houve criação de regra de frete contratado nem liberação de cobrança. `npm run price:preview` reproduz o cálculo com a referência registrada, sem atualizar automaticamente o câmbio.

## Integração de pedidos

A conexão do app autoriza o assistente a operar a conta Zendrop. Ela não instala um processo permanente na hospedagem da DAVORA. O conjunto de ferramentas disponível consulta produtos e gerencia pedidos já existentes, mas não cria pedidos externos nem cadastra uma loja GitHub/Vercel. A única loja encontrada é a Wix em inglês; nenhum produto foi importado nela e suas configurações comerciais não foram alteradas. O cliente OAuth exclusivo criado para a DAVORA Brasil ainda não tem chave privada no servidor.

`supplierConnection.status` registra a conexão do assistente como `connected`. `fulfillmentIntegration.status` agora é `pending_authorization`: a ponte Wix está implementada em preparação, mas ainda não envia pedidos. Falta a credencial privada do cliente e o vínculo dos 30 produtos. A documentação lista integrações nativas com Shopify, TikTok Shop US, ClickFunnels e Wix. Pedidos externos são descritos como um fluxo manual de amostra, e não uma conexão automática gratuita. O backend escolhido é a Wix existente; sua autorização privada, os vínculos dos 30 modelos e o recebimento dos pedidos na Zendrop precisam ser validados antes da primeira venda.

Na conta Zendrop, este trabalho foi somente de consulta: não houve compra, nova assinatura, despacho, ativação de cobrança automática ou alteração da Wix. Valores e situação de faturamento da conta não são publicados neste documento.

## Seleção e custos de referência

| Produto | Variante selecionada | SKU | Produto (USD) | Frete estimado (USD) |
| --- | --- | --- | ---: | ---: |
| Suporte de mesa para headset | Base preta | 1773319276954943490 | 3.44 | 20.66 |
| Relógio digital RGB para montar | Kit RGB · montagem necessária | 1773317385575497728 | 24.43 | 30.84 |
| Caixa de som retrô AS19 | AS19 · acabamento Hua Li Jin | 1773319380772356096 | 16.98 | 22.52 |
| Headset gamer NUBWO N7 com fio | N7D · preto · plugue único de 3,5 mm | 1773697222198788096 | 13.94 | 22.03 |
| Fones sem fio TWS F9-5C | F9-5C · preto | 1773315321352978432 | 2.49 | 13.53 |
| Fone sem fio S109 | Preto · com cabo, manual e caixa | 1773319731403587594 | 0.96 | 12.49 |
| Fones TWS de condução aérea | Preto | 1773322371810230272 | 7.43 | 13.84 |
| Fones sem fio esportivos | B101 · preto · com caixa | 1773327147633508359 | 4.18 | 15.18 |
| Fones com fio Patinha Rosa | Rosa | 1775142122536603648 | 0.65 | 15.55 |
| Fones gamer sem fio com toque | Preto | 1775142124143030273 | 7.82 | 12.79 |
| Cabo USB-C HOCO X20 | Preto · USB-C · 1 m | 1773319490453405716 | 1.05 | 15.92 |
| Cabo de recarga USB-C | Preto · USB-C · 22,5 cm | 1773322170777239559 | 1.13 | 12.49 |
| Cabo chaveiro 4 em 1 USB-C | Cinza-escuro · versão 4 em 1 | 1773319668258340864 | 4.39 | 12.79 |
| Carregador magnético 4 em 1 | Preto · base metálica | 1773321711760998400 | 22.00 | 16.23 |
| Suporte carregador veicular A7 | A7 · preto | 1773322076724166658 | 5.73 | 15.26 |
| Kit USB-C de 4 peças para iPhone 15 | 4 peças · 35 W · iPhone 15 | 1773547747232776353 | 8.98 | 22.38 |
| Capa com brilho e apoio para iPhone | Branca · iPhone 15 Pro Max | 1773547892728987701 | 2.49 | 16.35 |
| Capa Armor com moldura para iPhone | iPhone 14 Pro Max | 1774105832666103808 | 5.35 | 16.14 |
| Capa rígida com apoio para iPhone | Preta · iPhone 15 Pro | 1773315317473247306 | 0.96 | 16.30 |
| Porta-cartões magnético para iPhone | Preto · variante indicada para iPhone 12 a 14 | 1773298874723602435 | 3.20 | 16.30 |
| Capa transparente para Galaxy | Transparente · Galaxy S24 | 1773322137503825920 | 0.52 | 16.04 |
| Capa fosca em acrílico para Galaxy | Preta · Galaxy S24 | 1773322469847892174 | 1.43 | 16.30 |
| Capa magnética para Galaxy | Cinza · Galaxy A55 5G | 1773327187793969161 | 1.51 | 15.92 |
| Capa com anel de apoio para Galaxy | Preta · Galaxy S23 Ultra | 1774134954079490048 | 1.43 | 15.80 |
| Capa texturizada para Galaxy | Preta · Galaxy S23 Ultra | 1773319515048804352 | 3.25 | 15.92 |
| Pulseira milanesa magnética | Preta · encaixe 38/40/41 mm | 1773315231724896256 | 1.24 | 12.64 |
| Pulseira milanesa com fivela | Prateada · encaixe 38/40/41 mm | 1773315280223633413 | 1.20 | 16.54 |
| Pulseira de elos em aço | Preta · encaixe 38/40 mm | 1773322039231283200 | 4.77 | 15.18 |
| Capa transparente para estojo de fones | TPU transparente · AirPods Pro 2 · sem alça | 1773324453984370726 | 0.29 | 16.04 |
| Capa floral para estojo de fones | Preta floral · AirPods Pro 2 | 1775142124797341699 | 2.49 | 15.55 |

## Fontes oficiais

- Conexão MCP: https://support.zendrop.com/en/articles/15349416-connect-zendrop-mcp-to-your-ai-assistant
- Referência técnica MCP: https://support.zendrop.com/en/articles/14461568-zendrop-mcp-developer-documentation
- Integrações: https://support.zendrop.com/en/articles/8176418-zendrop-e-commerce-platform-integrations
- Pedidos externos: https://support.zendrop.com/en/articles/8176420-how-to-fulfill-orders-received-outside-of-zendrop
- Requisitos internacionais: https://support.zendrop.com/en/articles/9492634-international-shipping-considerations-with-zendrop
- Tributos e alfândega: https://support.zendrop.com/en/articles/16100468-how-do-tariffs-and-customs-duties-affect-my-zendrop-orders

A configuração Stripe, verificação remota do registro durável, webhook e condições comerciais continuam documentadas em `docs/pedidos.md`. Nenhum dos dados acima, isoladamente, libera o checkout.
