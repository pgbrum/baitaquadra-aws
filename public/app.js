const form = document.getElementById('reserva-form');
const listaReservas = document.getElementById('lista-reservas');
const serverBadge = document.getElementById('server-badge');
const btnAtualizar = document.getElementById('btn-atualizar');

// Define a data padrão do formulário para hoje
document.getElementById('data').valueAsDate = new Date();

async function carregarInfoServidor() {
  try {
    const res = await fetch('/api/info');
    const info = await res.json();
    serverBadge.textContent = `Zona: ${info.az} | Instância: ${info.instanceId}`;

    serverBadge.classList.remove('az-a', 'az-b');
    if (info.az.endsWith('a')) {
      serverBadge.classList.add('az-a');
    } else if (info.az.endsWith('b')) {
      serverBadge.classList.add('az-b');
    }
  } catch {
    serverBadge.textContent = 'Servidor: offline';
  }
}

async function carregarReservas() {
  try {
    const res = await fetch('/api/reservas');
    const reservas = await res.json();

    listaReservas.innerHTML = '';

    if (!reservas.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'empty-msg';
      td.textContent = 'Nenhuma reserva cadastrada ainda.';
      tr.appendChild(td);
      listaReservas.appendChild(tr);
      return;
    }

    reservas.forEach((item) => {
      const tr = document.createElement('tr');

      const tdCliente = document.createElement('td');
      tdCliente.textContent = item.cliente;

      const tdQuadra = document.createElement('td');
      tdQuadra.textContent = item.quadra;

      const tdDataHora = document.createElement('td');
      tdDataHora.textContent = `${item.data} às ${item.horario}`;

      const tdOrigem = document.createElement('td');
      tdOrigem.textContent = item.servidorOrigem || '-';

      const tdAcao = document.createElement('td');
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-delete';
      btnDel.textContent = 'Cancelar';
      btnDel.onclick = () => deletarReserva(item.id);
      tdAcao.appendChild(btnDel);

      tr.append(tdCliente, tdQuadra, tdDataHora, tdOrigem, tdAcao);
      listaReservas.appendChild(tr);
    });
  } catch {
    listaReservas.innerHTML =
      '<tr><td colspan="5" class="empty-msg">Erro ao carregar dados do DynamoDB.</td></tr>';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    cliente: document.getElementById('cliente').value,
    quadra: document.getElementById('quadra').value,
    data: document.getElementById('data').value,
    horario: document.getElementById('horario').value
  };

  const res = await fetch('/api/reservas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    document.getElementById('cliente').value = '';
    await carregarInfoServidor();
    await carregarReservas();
  } else {
    alert('Não foi possível salvar a reserva.');
  }
});

async function deletarReserva(id) {
  const res = await fetch(`/api/reservas/${id}`, { method: 'DELETE' });
  if (res.ok) {
    await carregarReservas();
  }
}

btnAtualizar.addEventListener('click', () => {
  carregarInfoServidor();
  carregarReservas();
});

carregarInfoServidor();
carregarReservas();