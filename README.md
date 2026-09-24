# DAVORA

Site público: https://davidsonroberto.github.io/DAVORA/

## Estado atual (24/09/2026)

A página principal é um catálogo de 14 itens ilustrativos. O cliente monta uma lista, informa nome e CEP e abre uma consulta no WhatsApp. Não há fornecedor vinculado, saldo de estoque, preço confirmado, frete calculado ou checkout ativo. Não apresentar os itens como disponíveis para venda imediata.

## Caminho de integração mantendo este endereço

1. Usar Wix Stores / Wix Headless como catálogo, carrinho e checkout. A interface continua hospedada no GitHub Pages; o checkout pode abrir em uma página segura da Wix e retornar a esta URL.
2. Conectar Dropi à loja Wix, selecionar produtos nacionais, validar fornecedores, variações, preços, imagens e estoque na conta do lojista.
3. Criar o projeto Wix Headless e seu OAuth app, autorizar davidsonroberto.github.io como domínio de retorno e configurar o domínio das páginas Wix.
4. Substituir os itens ilustrativos pelos produtos recebidos da Wix e integrar carrinho e checkout do Wix SDK. Exibir estoque apenas a partir dos dados do fornecedor, com confirmação no pagamento.
5. Habilitar os pagamentos no painel da Wix, conferir os custos e testar uma compra completa e o repasse do pedido ao fornecedor antes de retirar o aviso de consulta.

Dependências externas: acesso à conta Wix do proprietário, cadastro/adesão ao fornecedor Dropi, escolha de produtos liberados na conta e plano Wix apto a receber pagamentos. Não colocar senhas, tokens ou dados financeiros neste repositório.

Fontes oficiais:
- https://dev.wix.com/docs/go-headless/self-managed-headless/tutorials/java-script-sdk-tutorials/e-commerce-quick-start
- https://dev.wix.com/docs/go-headless/get-started/choose-your-development-path
- https://dropi.com.br/dropnacional
- https://support.wix.com/en/article/creating-and-setting-up-a-wix-headless-site
