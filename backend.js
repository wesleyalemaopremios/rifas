const express = require('express');
const https = require('https');
const fs = require('fs');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Configurações da API Efí Bank
const EFIBANK_BASE_URL = 'https://pix-h.api.efipay.com.br'; // Ambiente de homologação
const CLIENT_ID = 'Client_Id_893a3146c78f9edb6b98df343103080fe4063f60';
const CLIENT_SECRET = 'Client_Secret_f6f2398a5fcd56c5f3efdcd7557a6a8ec7f96db9';
const CERT_PATH = './certificados/homologacao-680504-loja2.p12';

// Função para obter o access_token
async function getAccessToken() {
  try {
    const certificado = fs.readFileSync(CERT_PATH);

    const agent = new https.Agent({
      pfx: certificado,
      passphrase: '',
    });

    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

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
    return res.status(400).json({ erro: 'Valor inválido.' });
  }

  try {
    const accessToken = await getAccessToken();

    const certificado = fs.readFileSync(CERT_PATH);
    const agent = new https.Agent({
      pfx: certificado,
      passphrase: '',
    });

    const response = await axios.post(
      `${EFIBANK_BASE_URL}/v2/cob`,
      {
        calendario: { expiracao: 3600 },
        valor: { original: valor.toFixed(2) },
        chave: 'mtt.h10@hotmail.com', // Substitua pela chave Pix cadastrada na sua conta Efí
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
