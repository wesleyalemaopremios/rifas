const express = require('express');
const https = require('https');
const fs = require('fs');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());

// Habilitar CORS para permitir requisições do frontend
app.use(cors({
  origin: 'https://wesleyalemaopremios.github.io' // Permitir apenas o frontend específico
}));

// Configurações da API Efí Bank
const EFIBANK_BASE_URL = 'https://pix-h.api.efipay.com.br'; // Ambiente de homologação
const CLIENT_ID = 'Client_Id_81ae6fbca0e6de8d8ce690690289bfd6e2e1d7bf';
const CLIENT_SECRET = 'Client_Secret_57bd0d434850d5d8c578e01df13750a1a3ced239';
const CERT_PATH = './homologacao-680504-loja2.p12';

// Função para obter o access_token
async function getAccessToken() {
  try {
    console.log('Iniciando a obtenção do access_token...');
    const certificado = fs.readFileSync(CERT_PATH);
    console.log('Certificado lido com sucesso.');

    const agent = new https.Agent({
      pfx: certificado,
      passphrase: '',
    });

    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    console.log('Autenticação codificada com sucesso.');

    const response = await axios.post(
      `${EFIBANK_BASE_URL}/oauth/token`,
      { grant_type: 'client_credentials' },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        httpsAgent: agent,
      }
    );

    console.log('Access token obtido com sucesso.');
    return response.data.access_token;
  } catch (error) {
    console.error('Erro ao obter o access_token:', error);
    throw new Error('Erro ao autenticar na API do Efí Bank.');
  }
}

// Endpoint para gerar chave Pix e QR Code
app.post('/gerar-chave-pix', async (req, res) => {
  const { valor } = req.body;

  if (!valor || valor <= 0) {
    console.log('Valor inválido recebido:', valor);
    return res.status(400).json({ erro: 'Valor inválido.' });
  }

  try {
    console.log('Iniciando processo de geração da chave Pix...');
    const accessToken = await getAccessToken();

    const certificado = fs.readFileSync(CERT_PATH);
    console.log('Certificado lido com sucesso para geração do Pix.');

    const agent = new https.Agent({
      pfx: certificado,
      passphrase: '',
    });

    const response = await axios.post(
      `${EFIBANK_BASE_URL}/v2/cob`,
      {
        calendario: { expiracao: 3600 },
        valor: { original: valor.toFixed(2) },
        chave: '3467e73a-9b39-48eb-a9bd-466cafc5666e', // Substitua pela chave Pix cadastrada na sua conta Efí
        solicitacaoPagador: 'Pagamento do título Wesley Alemão.',
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        httpsAgent: agent,
      }
    );

    console.log('Chave Pix gerada com sucesso.');
    const pixData = response.data;
    return res.json({
      location: pixData.loc.location, // URL do QR Code
      pix: pixData.txid, // Chave Pix gerada
    });
  } catch (error) {
    console.error('Erro ao gerar chave Pix:', error);
    return res.status(500).json({ erro: 'Erro ao gerar chave Pix.' });
  }
});

// Servir na porta 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
