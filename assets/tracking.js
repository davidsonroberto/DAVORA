const $ = id => document.getElementById(id);
const token = new URLSearchParams(location.search).get('token');
const messages = {
  dispatched: 'Seu pedido foi enviado. Confira abaixo o código de rastreamento.',
  tracking_available: 'Os códigos de rastreamento abaixo estão disponíveis. A movimentação depende da transportadora, e os itens podem chegar em pacotes separados.',
  processing: 'Pagamento confirmado. Seu pedido está sendo preparado para envio.',
  review_required: 'Seu pedido está em conferência. Fale com a DAVORA para receber uma atualização.',
  payment_pending: 'O pagamento ainda está em confirmação. Atualize novamente em instantes.'
};
async function refresh() {
  $('refreshTracking').disabled = true;
  $('shipmentDetails').hidden = true;
  $('shipmentList').hidden = true;
  $('shipmentList').replaceChildren();
  try {
    if (!token) throw new Error('Abra o link de acompanhamento fornecido após o pagamento.');
    const response = await fetch('/api/order-tracking?token=' + encodeURIComponent(token), { cache: 'no-store', referrerPolicy: 'no-referrer' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o pedido.');
    $('trackingReference').textContent = data.reference;
    $('trackingMessage').textContent = messages[data.status] || messages.payment_pending;
    if (data.trackingRefreshPending) $('trackingMessage').textContent += ' A consulta de novos rastreios está temporariamente indisponível. Tente atualizar novamente.';
    $('trackingSupport').href = 'https://wa.me/5531991339648?text=' + encodeURIComponent('Olá, preciso de ajuda com o pedido ' + data.reference + '.');
    if (data.status === 'dispatched' && data.tracking) {
      $('trackingCarrier').textContent = data.carrier;
      $('trackingCode').textContent = data.tracking;
      $('trackingUpdated').textContent = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(data.updatedAt));
      $('shipmentDetails').hidden = false;
    }
    for (const shipment of data.shipments || []) {
      const card = document.createElement('p'), label = document.createElement('b'), code = document.createElement('span');
      label.textContent = shipment.carrier + ': ';
      code.textContent = shipment.tracking;
      card.append(label, code); $('shipmentList').append(card); $('shipmentList').hidden = false;
    }
  } catch (error) { $('trackingMessage').textContent = error.message; }
  finally { $('refreshTracking').disabled = !token; }
}
$('refreshTracking').addEventListener('click', refresh);
refresh();
