const express = require('express');
const path = require('path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  DeleteCommand
} = require('@aws-sdk/lib-dynamodb');

const app = express();
const PORT = process.env.PORT || 3000;
const TABLE_NAME = 'BaitaQuadraReservas';

// Conecta ao DynamoDB na região us-east-1 usando a Role LabInstanceProfile da EC2
const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Busca o ID da instância EC2 e a Zona de Disponibilidade (us-east-1a ou us-east-1b)
async function getEc2Metadata() {
  try {
    const tokenRes = await fetch('http://169.254.169.254/latest/api/token', {
      method: 'PUT',
      headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' },
      signal: AbortSignal.timeout(1000)
    });
    const token = await tokenRes.text();
    const headers = { 'X-aws-ec2-metadata-token': token };

    const [idRes, azRes] = await Promise.all([
      fetch('http://169.254.169.254/latest/meta-data/instance-id', {
        headers,
        signal: AbortSignal.timeout(1000)
      }),
      fetch('http://169.254.169.254/latest/meta-data/placement/availability-zone', {
        headers,
        signal: AbortSignal.timeout(1000)
      })
    ]);

    return {
      instanceId: await idRes.text(),
      az: await azRes.text()
    };
  } catch {
    return { instanceId: 'local-machine', az: 'ambiente-local' };
  }
}

// Endpoint de Health Check e identificação do servidor
app.get('/api/info', async (req, res) => {
  const info = await getEc2Metadata();
  res.json(info);
});

// Listar todas as reservas (Consulta no DynamoDB)
app.get('/api/reservas', async (req, res) => {
  try {
    const data = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    const itensOrdenados = (data.Items || []).sort((a, b) =>
      b.criadoEm.localeCompare(a.criadoEm)
    );
    res.json(itensOrdenados);
  } catch (err) {
    console.error('Erro ao listar reservas:', err);
    res.status(500).json({ erro: 'Falha ao consultar o DynamoDB.' });
  }
});

// Criar nova reserva (Gravação no DynamoDB)
app.post('/api/reservas', async (req, res) => {
  const { cliente, quadra, data, horario } = req.body;

  if (!cliente || !quadra || !data || !horario) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }

  const info = await getEc2Metadata();
  const novaReserva = {
    id: Date.now().toString(),
    cliente: cliente.trim(),
    quadra,
    data,
    horario,
    servidorOrigem: `${info.az} (${info.instanceId})`,
    criadoEm: new Date().toISOString()
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: novaReserva
      })
    );
    res.status(201).json(novaReserva);
  } catch (err) {
    console.error('Erro ao salvar reserva:', err);
    res.status(500).json({ erro: 'Falha ao gravar no DynamoDB.' });
  }
});

// Cancelar reserva (Exclusão no DynamoDB)
app.delete('/api/reservas/:id', async (req, res) => {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id: req.params.id }
      })
    );
    res.json({ mensagem: 'Reserva removida.' });
  } catch (err) {
    console.error('Erro ao deletar reserva:', err);
    res.status(500).json({ erro: 'Falha ao excluir no DynamoDB.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor BaitaQuadra rodando na porta ${PORT}`);
});