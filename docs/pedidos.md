# Pedidos e estoque da DAVORA

Implementação de preparação em 16/10/2026. As compras permanecem desativadas.

## Armazenamento

Foi criado o Vercel Blob privado `davora-orders`, ID `store_CVtTIkSdocv9d9RW`, na região iad1, conectado ao projeto davora. Em 16/10/2026, `BLOB_READ_WRITE_TOKEN` foi restringido a **preview** e convertido em variável **sensitive**, preservando o valor sem lê-lo nem rotacioná-lo. A API e o painel autenticado confirmaram o novo tipo e escopo. As chaves de criptografia e assinatura criadas para esta preparação também ficam somente em variáveis sensíveis de preview. Não perder ou trocar a chave de criptografia com pedidos existentes sem migrar os dados.

O novo escopo vale para publicações futuras. Não revoga o token nem remove cópias já incorporadas a deploys antigos; não considerar isso uma revogação completa de acesso de produção. Antes de dados reais, criar armazenamento e credenciais separados e revisar os deploys antigos.

O ledger é privado e separado por namespace e ambiente Stripe. Dados de contato, CPF e endereço ficam criptografados com AES-256-GCM, com autenticação vinculada à referência do pedido. Nenhum dado de cartão é armazenado. Preços e quantidades continuam validados no servidor.

Ordens e reservas compartilham uma atualização condicional por ETag. Em conflito, a transação relê a versão mais recente antes de conferir o estoque e gravar. As leituras não usam cache. Não há fallback para memória ou disco temporário em produção. Uma falha na gravação impede a criação da sessão Stripe.

Esta é uma implementação para operação pequena: novas reservas param em 1.000 pedidos ou 2 MiB no ledger, deixando espaço para confirmação e rastreio dos pedidos existentes até o limite total de 3 MiB. Ao atingir o limite de reservas, novos pedidos falham com indisponibilidade, sem cobrar o cliente. Antes de ultrapassar esses limites, migrar para um banco transacional. A manutenção e exportação de registros reais exige acesso restrito do responsável pela loja.

## Ciclo de um pedido

1. O servidor valida a cotação e os dados de entrega.
2. Grava o pedido e reserva o estoque antes de pedir uma sessão à Stripe.
3. Cria a sessão usando a mesma chave idempotente nas repetições e registra seu ID antes de retornar o formulário ao comprador.
4. `/api/stripe-webhook` verifica a assinatura do corpo bruto, o tempo da assinatura, o ambiente e o evento. Consulta a sessão na Stripe e confere referência, valor, moeda e fingerprint antes de atualizar o pedido.
5. Somente sessão concluída e paga muda o pedido para `paid` e `pending_supplier`. Isso indica uma fila para o responsável, não comprova pedido ao fornecedor ou despacho.
6. Expiração ou falha assíncrona confirmada libera a reserva. A expiração de um relógio local, sozinha, não libera estoque: o pagamento pode ter sido concluído antes da chegada da notificação.
7. Confirmação paga após uma reserva já liberada fica em `review_required`; não há promessa automática de envio. Rastreio só pode ser registrado para um pedido pago sem pendência de revisão.

Uma falha de rede ambígua na criação da sessão mantém a reserva. Repetir a mesma tentativa e cotação ainda válida reutiliza a chave idempotente. Se a cotação expirar sem resolução, o responsável deve localizar a referência na Stripe e reconciliar antes de liberar a reserva; não iniciar outra cobrança para compensar uma resposta desconhecida.

O código não efetua compras no fornecedor, reembolsos, reserva no sistema do fornecedor ou envio de mensagens. O pagamento na Stripe continua separado da autorização e do despacho no fornecedor. Antes de operar, é necessária uma rotina do responsável para consultar a fila, comprar os itens autorizados, registrar o envio e atender falhas/devoluções.

## Ativação pendente

- Manter o armazenamento de teste separado do armazenamento de pedidos reais antes de habilitar produção. O token de teste foi restringido a preview e protegido como sensitive; deploys antigos precisam ser considerados na revisão de acesso.
- A prévia ainda não tem credenciais Stripe de teste; as credenciais gerenciadas existentes estão apenas em production. Não copiar chaves de produção para o preview.
- Cadastrar um endpoint HTTPS alcançável pela Stripe em `/api/stripe-webhook`, com eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` e `checkout.session.expired`.
- Cadastrar o segredo específico do endpoint em `STRIPE_WEBHOOK_SECRET` por configuração segura e verificar a entrega de um evento de teste antes de mudar `DAVORA_WEBHOOK_VERIFIED` para true.
- O login na Vercel foi concluído. A abertura do endpoint remoto no navegador desta sessão retornou `net::ERR_BLOCKED_BY_CLIENT`, tanto no deploy quanto no alias estável. Isso não demonstra falha no Blob nem identifica bloqueio por robô. `/api/order-system-health` faz apenas uma leitura de conexão e não retorna pedidos nem dados pessoais. O recurso está disponível segundo a API da Vercel; a leitura/gravação real por esse deploy ainda precisa ser verificada. A proteção de acesso da prévia foi mantida.
- A conta Stripe conectada ao ChatGPT foi consultada novamente: país BR, moeda brl, cartões e boleto ativos no contexto de teste autorizado. Não há endpoints webhook cadastrados nesse contexto. Isso não comprova a natureza das chaves da Vercel nem a ativação de produção. A criação rápida de sandbox da integração Vercel exibe somente US/CA e USD/CAD; nenhum sandbox com país ou moeda diferentes foi criado.
- O painel da Vercel identifica o plano atual como Hobby. Antes da operação comercial, definir uma hospedagem/plano que permita esse uso. A política oficial exige Pro ou Enterprise para uso comercial na Vercel: https://vercel.com/docs/limits/fair-use-guidelines . Nenhuma assinatura paga foi contratada.
- Aprovar fornecimento, SKU, fotos, custos, estoque, preço final, frete e condições comerciais. Nenhum preço, prazo ou autorização deve ser inventado para abrir as vendas.

`npm test` cobre concorrência na última unidade, repetição de pedidos, criptografia e vínculo do destinatário, expiração e confirmações atrasadas, eventos repetidos/fora de ordem, pagamento divergente, assinatura alterada, consulta autoritativa à Stripe e recusa de cobrança quando a gravação falha. O adaptador do ledger e a Stripe são simulados nesses testes; eles não substituem a verificação remota.
